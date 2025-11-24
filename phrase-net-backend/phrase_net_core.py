import networkx as nx
import re
import stanza
from collections import Counter
from itertools import combinations
import io


try:
    STANZA_NLP = stanza.Pipeline(
        lang="en",
        processors="tokenize,mwt,pos,lemma,depparse",
        verbose=False,
        download_method=None,
    )
except Exception as e:
    print(f"Error starting Stanza: {e}")
    STANZA_NLP = None


def _preprocess_text(text: str) -> str:
    return text.lower().strip()


def _orthographic_linking(text: str, pattern: str) -> nx.DiGraph:
    graph = nx.DiGraph()
    if not STANZA_NLP:
        tokens = re.findall(r"\b\w+\b", text.lower())
    else:
        doc = STANZA_NLP(text)
        tokens = [
            word.lemma.lower()
            for sent in doc.sentences
            for word in sent.words
            if word.upos != "PUNCT" and word.upos != "SPACE"
        ]

    token_frequency = Counter(tokens)

    for token, freq in token_frequency.items():
        graph.add_node(token, frequency=freq)

    window_size = 5
    for i in range(len(tokens) - window_size + 1):
        window = tokens[i : i + window_size]
        for node1, node2 in combinations(set(window), 2):
            if node1 != node2:
                if graph.has_edge(node1, node2):
                    graph[node1][node2]["weight"] += 1
                else:
                    graph.add_edge(node1, node2, weight=1)
    return graph


def _syntactic_linking(text: str) -> nx.DiGraph:
    if not STANZA_NLP:
        raise RuntimeError("Stanza not loaded. Cannot run Syntactic Linking.")

    graph = nx.DiGraph()
    doc = STANZA_NLP(text)

    tokens = []
    for sent in doc.sentences:
        for word in sent.words:
            if word.upos != "PUNCT" and word.upos != "SPACE":
                tokens.append(word.lemma.lower())

    token_frequency = Counter(tokens)

    RELEVANT_DEPS = ["nsubj", "obj", "iobj", "conj", "acl", "advcl"]

    for sentence in doc.sentences:
        word_map = {i + 1: word for i, word in enumerate(sentence.words)}
        for word in sentence.words:
            if word.head > 0 and word.deprel in RELEVANT_DEPS:
                head_word = word_map.get(word.head)
                if head_word and word.upos != "PUNCT" and head_word.upos != "PUNCT":
                    node_from = head_word.lemma.lower()
                    node_to = word.lemma.lower()
                    relation_type = word.deprel

                    if not graph.has_node(node_from):
                        graph.add_node(
                            node_from, frequency=token_frequency.get(node_from, 1)
                        )
                    if not graph.has_node(node_to):
                        graph.add_node(
                            node_to, frequency=token_frequency.get(node_to, 1)
                        )
                    if node_from != node_to:
                        if graph.has_edge(node_from, node_to):
                            graph[node_from][node_to]["weight"] += 1
                        else:
                            graph.add_edge(
                                node_from, node_to, weight=1, relation=relation_type
                            )
    return graph


def _filter_network(
    graph: nx.DiGraph, max_nodes: int, stopwords: list = None
) -> nx.DiGraph:
    if stopwords is None:
        stopwords = []

    stopwords_set = set(w.lower() for w in stopwords)

    node_scores = {
        node: sum(data["weight"] for _, _, data in graph.edges(node, data=True))
        + sum(data["weight"] for _, _, data in graph.in_edges(node, data=True))
        for node in graph.nodes()
    }

    sorted_nodes = sorted(node_scores.items(), key=lambda item: item[1], reverse=True)

    selected_nodes = []
    idx = 0

    while len(selected_nodes) < max_nodes and idx < len(sorted_nodes):
        node, score = sorted_nodes[idx]
        idx += 1

        if node.lower() not in stopwords_set and not node.startswith("SUPER_NODE:"):
            selected_nodes.append(node)

    while len(selected_nodes) < max_nodes and idx < len(sorted_nodes):
        node, score = sorted_nodes[idx]
        idx += 1
        selected_nodes.append(node)

    filtered_graph = graph.subgraph(selected_nodes).copy()

    return filtered_graph


def _compress_edges(graph: nx.DiGraph) -> nx.DiGraph:
    """
    Comprime arestas agrupando nós topologicamente equivalentes.
    """
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
                compressed_graph.add_edge(u_new, v_new, weight=weight)

    return compressed_graph


def _serialize_graph(graph: nx.DiGraph, stopwords: list = None) -> dict:
    if stopwords is None:
        stopwords = []

    stopwords_set = set(w.lower() for w in stopwords)

    nodes = []
    for n in graph.nodes():
        if n.lower() in stopwords_set:
            continue

        if n.startswith("SUPER_NODE:"):
            continue

        frequency = graph.nodes[n].get("frequency", 1)
        in_degree = graph.in_degree(n)
        out_degree = graph.out_degree(n)

        nodes.append(
            {
                "id": n,
                "label": n,
                "frequency": frequency,
                "inDegree": in_degree,
                "outDegree": out_degree,
            }
        )

    valid_node_ids = {n["id"] for n in nodes}

    edges = []
    for u, v, d in graph.edges(data=True):
        if u in valid_node_ids and v in valid_node_ids:
            edges.append({"source": u, "target": v, "weight": d.get("weight", 1)})

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


def run_phrase_net_analysis(
    raw_text: str,
    linking_type: str,
    pattern: str = None,
    max_nodes: int = 100,
    stopwords: list = None,
) -> dict:
    """
    Executa análise completa de Phrase Nets.
    """
    if stopwords is None:
        stopwords = []

    text = _preprocess_text(raw_text)

    if linking_type == "orthographic":
        if not pattern:
            raise ValueError("The 'pattern' is mandatory for Orthographic Linking.")
        initial_graph = _orthographic_linking(text, pattern)
    elif linking_type == "syntactic":
        initial_graph = _syntactic_linking(text)
    else:
        raise ValueError("Invalid linking type. Use 'orthographic' or 'syntactic'.")

    if not initial_graph.nodes:
        return _serialize_graph(initial_graph, stopwords)

    filtered_graph = _filter_network(initial_graph, max_nodes, stopwords)
    final_compressed_graph = _compress_edges(filtered_graph)

    return _serialize_graph(final_compressed_graph, stopwords)
