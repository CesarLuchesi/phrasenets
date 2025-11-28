import networkx as nx
import re
import spacy
import stanza
from collections import Counter
from itertools import combinations
from typing import List, Optional

# --- NLP Global Settings ---
NLP_CONFIG = {
    'tool_name': None,
    'pipeline': None
}

def load_nlp_pipeline(tool_name: str):

    global NLP_CONFIG
    
    if NLP_CONFIG['tool_name'] == tool_name and NLP_CONFIG['pipeline'] is not None:
        return

    NLP_CONFIG['tool_name'] = tool_name
    
    if tool_name == 'spacy':
        try:
            print("Carregando SpaCy...")
            NLP_CONFIG['pipeline'] = spacy.load('en_core_web_sm')
        except OSError:
            raise RuntimeError("Modelo 'en_core_web_sm' do SpaCy não encontrado. Execute 'python -m spacy download en_core_web_sm'.")
    
    elif tool_name == 'stanza':
        try:
            print("Carregando Stanza...")
            NLP_CONFIG['pipeline'] = stanza.Pipeline(
                lang='en', 
                processors='tokenize,mwt,pos,lemma,depparse', 
                verbose=False, 
                download_method=None
            )
        except Exception as e:
            raise RuntimeError(f"Erro ao carregar Stanza. Verifique a instalação: {e}")
    
    else:
        raise ValueError("Ferramenta NLP inválida. Use 'spacy' ou 'stanza'.")


def _preprocess_text(text: str) -> str:
    return text.lower().strip()


def _orthographic_linking(text: str, pattern: str, stopwords: List[str]) -> nx.DiGraph:
    graph = nx.DiGraph()
    nlp = NLP_CONFIG['pipeline']
    tool = NLP_CONFIG['tool_name']
    stopwords_set = set(stopwords)

    lemmas = []
    
    if not nlp:
        tokens = re.findall(r"\b\w+\b", text.lower())
        lemmas = [w for w in tokens if w not in stopwords_set]
    else:
        doc = nlp(text)
        if tool == 'spacy':
            lemmas = [token.lemma_.lower() for token in doc 
                      if not token.is_punct and not token.is_space and not token.is_stop and token.lemma_.lower() not in stopwords_set]
        elif tool == 'stanza':
            lemmas = [word.lemma.lower() for sent in doc.sentences for word in sent.words 
                      if word.upos not in ("PUNCT", "SPACE") and word.lemma.lower() not in stopwords_set]
    
    token_frequency = Counter(lemmas)

    for token, freq in token_frequency.items():
        graph.add_node(token, frequency=freq)

    window_size = 5
    for i in range(len(lemmas) - window_size + 1):
        window = lemmas[i:i + window_size]
        for node1, node2 in combinations(set(window), 2):
            if node1 != node2:
                if graph.has_edge(node1, node2):
                    graph[node1][node2]["weight"] += 1
                else:
                    graph.add_edge(node1, node2, weight=1)
                    
    return graph


def _syntactic_linking(text: str, stopwords: List[str]) -> nx.DiGraph:
    nlp = NLP_CONFIG['pipeline']
    tool = NLP_CONFIG['tool_name']
    stopwords_set = set(stopwords)

    if not nlp:
        raise RuntimeError(f"Ferramenta NLP ({tool}) não carregada. Não é possível rodar Syntactic Linking.")

    graph = nx.DiGraph()
    doc = nlp(text)
    RELEVANT_DEPS = ["nsubj", "obj", "iobj", "conj", "acl", "advcl"]

    lemmas = []
    if tool == 'spacy':
        lemmas = [token.lemma_.lower() for token in doc if not token.is_punct and not token.is_space and not token.is_stop]
    elif tool == 'stanza':
        for sent in doc.sentences:
            for word in sent.words:
                if word.upos not in ("PUNCT", "SPACE"):
                    lemmas.append(word.lemma.lower())
    
    token_frequency = Counter(lemmas)
    
    if tool == 'spacy':
        for token in doc:
            if token.dep_ in RELEVANT_DEPS and not token.is_punct and not token.is_space:
                head = token.head
                
                node_from = head.lemma_.lower()
                node_to = token.lemma_.lower()
                relation_type = token.dep_
                
                if (node_from != node_to and 
                    node_from not in stopwords_set and node_to not in stopwords_set and
                    not head.is_punct and not head.is_space):
                    
                    for node in [node_from, node_to]:
                        if not graph.has_node(node):
                             graph.add_node(node, frequency=token_frequency.get(node, 1))

                    if graph.has_edge(node_from, node_to):
                        graph[node_from][node_to]['weight'] += 1
                    else:
                        graph.add_edge(node_from, node_to, weight=1, relation=relation_type)

    elif tool == 'stanza':
        for sentence in doc.sentences:
            word_map = {i + 1: word for i, word in enumerate(sentence.words)}
            
            for word in sentence.words:
                if word.head > 0 and word.deprel in RELEVANT_DEPS:
                    head_word = word_map.get(word.head)
                    
                    if head_word and word.upos != 'PUNCT' and head_word.upos != 'PUNCT':
                        node_from = head_word.lemma.lower()
                        node_to = word.lemma.lower()
                        relation_type = word.deprel
                        
                        if (node_from != node_to and 
                            node_from not in stopwords_set and node_to not in stopwords_set):
                            
                            for node in [node_from, node_to]:
                                if not graph.has_node(node):
                                    graph.add_node(node, frequency=token_frequency.get(node, 1))

                            if graph.has_edge(node_from, node_to):
                                graph[node_from][node_to]["weight"] += 1
                            else:
                                graph.add_edge(node_from, node_to, weight=1, relation=relation_type)

    return graph


def _filter_network(
    graph: nx.DiGraph, max_nodes: int, stopwords: Optional[List[str]] = None
) -> nx.DiGraph:
    
    if stopwords is None:
        stopwords = []

    stopwords_set = set(w.lower() for w in stopwords)
    
    node_scores = {}
    nodes_to_remove = []
    for node in graph.nodes():
        if node.lower() in stopwords_set:
            nodes_to_remove.append(node)
            continue
        
        score = (
            sum(data["weight"] for _, _, data in graph.edges(node, data=True))
            + sum(data["weight"] for _, _, data in graph.in_edges(node, data=True))
        )
        node_scores[node] = score

    temp_graph = graph.copy()
    temp_graph.remove_nodes_from(nodes_to_remove)

    sorted_nodes = sorted(node_scores.items(), key=lambda item: item[1], reverse=True)
    
    selected_nodes = []
    idx = 0
    
    while len(selected_nodes) < max_nodes and idx < len(sorted_nodes):
        node, score = sorted_nodes[idx]
        idx += 1
        
        if not node.startswith("SUPER_NODE:"):
            selected_nodes.append(node)
        
    while len(selected_nodes) < max_nodes and idx < len(sorted_nodes):
        node, score = sorted_nodes[idx]
        idx += 1
        selected_nodes.append(node)

    filtered_graph = temp_graph.subgraph(selected_nodes).copy()
    
    filtered_graph.remove_nodes_from(list(nx.isolates(filtered_graph)))
    
    return filtered_graph


def _compress_edges(graph: nx.DiGraph) -> nx.DiGraph:

    if not graph.nodes:
        return graph

    equivalent_nodes = []
    nodes_to_check = set(graph.nodes())

    while nodes_to_check:
        node = nodes_to_check.pop()
        group = {node}
        in_neighbors = set(graph.predecessors(node))
        out_neighbors = set(graph.successors(node))

        for other_node in list(nodes_to_check):
            if (
                set(graph.predecessors(other_node)) == in_neighbors
                and set(graph.successors(other_node)) == out_neighbors
            ):
                group.add(other_node)
                nodes_to_check.remove(other_node)

        if len(group) > 1:
            equivalent_nodes.append(list(group))

    compressed_graph = nx.DiGraph()
    node_map = {node: node for node in graph.nodes()}

    for group in equivalent_nodes:
        super_node_name = f"SUPER_NODE:{'|'.join(group)}"
        for node in group:
            node_map[node] = super_node_name

        total_frequency = sum(graph.nodes[n].get("frequency", 1) for n in group)
        compressed_graph.add_node(
            super_node_name, group_members=group, frequency=total_frequency
        )

    for u, v, data in graph.edges(data=True):
        u_new = node_map.get(u, u)
        v_new = node_map.get(v, v)

        if u_new != v_new:
            weight = data.get("weight", 1)
            if compressed_graph.has_edge(u_new, v_new):
                compressed_graph[u_new][v_new]["weight"] += weight
            else:
                # Mantém a relação se for a primeira aresta
                relation = data.get("relation") 
                compressed_graph.add_edge(u_new, v_new, weight=weight, relation=relation)

    return compressed_graph


def _serialize_graph(graph: nx.DiGraph, stopwords: Optional[List[str]] = None) -> dict:

    if stopwords is None:
        stopwords = []

    stopwords_set = set(w.lower() for w in stopwords)

    nodes = []
    valid_node_ids = set()
    
    for n in graph.nodes():
        if n.lower() in stopwords_set:
            continue
        if n.startswith("SUPER_NODE:"):
            continue

        frequency = graph.nodes[n].get("frequency", 1)
        in_degree = graph.in_degree(n)
        out_degree = graph.out_degree(n)
        
        node_data = {
            "id": n,
            "label": n,
            "frequency": frequency,
            "inDegree": in_degree,
            "outDegree": out_degree,
        }
        
        if "group_members" in graph.nodes[n]:
            node_data["group_members"] = graph.nodes[n]["group_members"]
            
        nodes.append(node_data)
        valid_node_ids.add(n)

    edges = []
    for u, v, d in graph.edges(data=True):
        if u in valid_node_ids and v in valid_node_ids:
            edges.append({
                "source": u, 
                "target": v, 
                "weight": d.get("weight", 1),
                "relation": d.get("relation") 
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


def run_phrase_net_analysis(
    raw_text: str,
    linking_type: str,
    nlp_tool: str, 
    pattern: str = None,
    max_nodes: int = 100,
    stopwords: List[str] = None,
) -> dict:

    if stopwords is None:
        stopwords = []
    
    try:
        load_nlp_pipeline(nlp_tool)
    except (RuntimeError, ValueError) as e:
        raise e 

    text = _preprocess_text(raw_text)

    if linking_type == "orthographic":
        if not pattern:
            raise ValueError("The 'pattern' is mandatory for Orthographic Linking.")
        initial_graph = _orthographic_linking(text, pattern, stopwords)
    elif linking_type == "syntactic":
        initial_graph = _syntactic_linking(text, stopwords)
    else:
        raise ValueError("Invalid linking type. Use 'orthographic' or 'syntactic'.")

    if not initial_graph.nodes:
        return _serialize_graph(initial_graph, stopwords)

    filtered_graph = _filter_network(initial_graph, max_nodes, stopwords)
    final_compressed_graph = _compress_edges(filtered_graph)

    return _serialize_graph(final_compressed_graph, stopwords)