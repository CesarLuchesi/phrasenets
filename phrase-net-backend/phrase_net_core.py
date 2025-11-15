import networkx as nx
import re
import stanza
from collections import Counter
from itertools import combinations
import io

# --- Starting Stanza ---
try:
    STANZA_NLP = stanza.Pipeline(
        lang='en', 
        processors='tokenize,mwt,pos,lemma,depparse', 
        verbose=False, 
        download_method=None
    )
except Exception as e:
    print(f"Error starting Stanza: {e}")
    STANZA_NLP = None


def _preprocess_text(text: str) -> str:
    return text.lower().strip()


# --- TEXT ANALYSIS (LINKING) ---

def _orthographic_linking(text: str, pattern: str) -> nx.DiGraph:
    graph = nx.DiGraph()
    
    if not STANZA_NLP:
        # Fallback to simple tokenization if Stanza fails 
        tokens = re.findall(r'\b\w+\b', text.lower())
    else:
        doc = STANZA_NLP(text)
        tokens = [word.lemma.lower() for sent in doc.sentences for word in sent.words 
                  if word.upos != 'PUNCT' and word.upos != 'SPACE']
    
    # Creates edges based on window co-occurrence (practical Orthographic Linking)
    window_size = 5
    for i in range(len(tokens) - window_size + 1):
        window = tokens[i:i + window_size]
        for node1, node2 in combinations(set(window), 2):
            if node1 != node2:
                # Adds or increments the edge weight
                if graph.has_edge(node1, node2):
                    graph[node1][node2]['weight'] += 1
                else:
                    graph.add_edge(node1, node2, weight=1)
                    
    return graph


def _syntactic_linking(text: str) -> nx.DiGraph:
    if not STANZA_NLP:
        raise RuntimeError("Stanza not loaded. Cannot run Syntactic Linking.")

    graph = nx.DiGraph()
    doc = STANZA_NLP(text)

    # Dependency types to be considered as edges (common examples)
    RELEVANT_DEPS = ["nsubj", "obj", "iobj", "conj", "acl", "advcl"]

    for sentence in doc.sentences:
        # Creates an index-to-word mapping, as Stanza uses 1-based indices
        word_map = {i + 1: word for i, word in enumerate(sentence.words)}
        
        for word in sentence.words:
            # Stanza uses '0' for the ROOT token, which has no head in the Sentence
            if word.head > 0 and word.deprel in RELEVANT_DEPS:
                
                head_word = word_map.get(word.head)
                
                # Checks if the word and its head are valid to be nodes
                if head_word and word.upos != 'PUNCT' and head_word.upos != 'PUNCT':
                    
                    # Uses lemma and lowercase to unify the nodes
                    node_from = head_word.lemma.lower()
                    node_to = word.lemma.lower()
                    relation_type = word.deprel
                    
                    # Avoids self-loops
                    if node_from != node_to:
                        # Adds edge: Head (from article) -> Dependent
                        if graph.has_edge(node_from, node_to):
                            graph[node_from][node_to]['weight'] += 1
                        else:
                            graph.add_edge(node_from, node_to, weight=1, relation=relation_type)

    return graph


# --- NETWORK FILTERING ---

def _filter_network(graph: nx.DiGraph, max_nodes: int) -> nx.DiGraph:
    
    # 1. Calculate node relevance (sum of edge weights)
    node_scores = {node: sum(data['weight'] for _, _, data in graph.edges(node, data=True)) + \
                           sum(data['weight'] for _, _, data in graph.in_edges(node, data=True))
                   for node in graph.nodes()}
    
    # 2. Select the N most relevant nodes
    sorted_nodes = sorted(node_scores.items(), key=lambda item: item[1], reverse=True)
    top_nodes = [node for node, score in sorted_nodes[:max_nodes]]
    
    # 3. Return the subgraph
    filtered_graph = graph.subgraph(top_nodes).copy()
    filtered_graph.remove_nodes_from(list(nx.isolates(filtered_graph)))
    
    return filtered_graph


# --- EDGE COMPRESSION ---

def _compress_edges(graph: nx.DiGraph) -> nx.DiGraph:

    if not graph.nodes:
        return graph

    # Logic to find groups of nodes with the same incoming and outgoing neighbors
    equivalent_nodes = []
    nodes_to_check = set(graph.nodes())
    
    while nodes_to_check:
        node = nodes_to_check.pop()
        group = {node}
        in_neighbors = set(graph.predecessors(node))
        out_neighbors = set(graph.successors(node))

        for other_node in list(nodes_to_check):
            if (set(graph.predecessors(other_node)) == in_neighbors and
                set(graph.successors(other_node)) == out_neighbors):
                
                group.add(other_node)
                nodes_to_check.remove(other_node)
        
        if len(group) > 1:
            equivalent_nodes.append(list(group))

    # Building the Compressed Graph (Supernodes)
    compressed_graph = nx.DiGraph()
    node_map = {node: node for node in graph.nodes()}
    
    for group in equivalent_nodes:
        # Defines the supernode name and maps the group nodes to it
        super_node_name = f"SUPER_NODE:{'|'.join(group)}"
        for node in group:
            node_map[node] = super_node_name
        compressed_graph.add_node(super_node_name, group_members=group)

    # Adds edges by accumulating weights
    for u, v, data in graph.edges(data=True):
        u_new = node_map.get(u, u)
        v_new = node_map.get(v, v)
        
        if u_new != v_new:
            weight = data.get('weight', 1)
            if compressed_graph.has_edge(u_new, v_new):
                compressed_graph[u_new][v_new]['weight'] += weight
            else:
                compressed_graph.add_edge(u_new, v_new, weight=weight)
                
    return compressed_graph


# --- ORCHESTRATOR AND SERIALIZATION ---

def _serialize_graph(graph: nx.DiGraph) -> dict:
    return {
        "nodes": [{"id": n, "label": n, **graph.nodes[n]} for n in graph.nodes()],
        "edges": [{"source": u, "target": v, **d} for u, v, d in graph.edges(data=True)],
        "node_count": graph.number_of_nodes(),
        "edge_count": graph.number_of_edges(),
    }


def run_phrase_net_analysis(raw_text: str, linking_type: str, pattern: str = None, max_nodes: int = 100) -> dict:

    # Basic pre-processing
    text = _preprocess_text(raw_text)

    # 1. Initial Graph Generation (3.1)
    if linking_type == 'orthographic':
        if not pattern:
            # The 'pattern' is mandatory for Orthographic Linking.
            raise ValueError("The 'pattern' is mandatory for Orthographic Linking.")
        initial_graph = _orthographic_linking(text, pattern)
    elif linking_type == 'syntactic':
        # This function now uses Stanza!
        initial_graph = _syntactic_linking(text)
    else:
        raise ValueError("Invalid linking type. Use 'orthographic' or 'syntactic'.")

    if not initial_graph.nodes:
        return _serialize_graph(initial_graph)

    # 2. Network Filtering (3.2)
    filtered_graph = _filter_network(initial_graph, max_nodes)
    
    # 3. Edge Compression (3.3)
    final_compressed_graph = _compress_edges(filtered_graph)
    
    # 4. Result Serialization
    return _serialize_graph(final_compressed_graph)