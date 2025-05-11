// @ts-check
/** @module rtfExporter */

import { executeQuery } from '../../utils/neo4jConnection.js';

/**
 * @typedef {'CentralTopic' | 'Topic' | 'Paragraph' | 'ReferencedText' | 'Paper' | 'Unknown'} NodeType
 */

/**
 * @typedef {Object} ProcessedGraphNode
 * @property {string} id - Unique identifier (e.g., elementId from Neo4j)
 * @property {NodeType} type - Type of the node
 * @property {Object<string, any>} properties - Node properties
 * @property {Array<ProcessedGraphNode>} children - Child nodes
 * @property {number | null} siblingOrder - From 'siblingOrder' property, for sorting
 * @property {number} rtfLevel - Calculated depth for numbering and indentation
 * @property {string} [title] - e.g., Topic.name, Paragraph.Statement, Paper.title
 * @property {string} [textContent] - e.g., ReferencedText.text
 */

class GraphDataProcessor {
    async processGraphData(rootNodeId) {
        if (!rootNodeId) {
            console.error('No rootNodeId provided');
            return null;
        }

        // Simplified Cypher query to return nodes and relationships
        const cypherQuery = `
            MATCH (root) WHERE root.elementId = $rootNodeId OR root.elementId = toString($rootNodeId) OR ID(root) = toInteger(split($rootNodeId, ':')[2])

            // Find all nodes reachable from the root via relevant relationships
            OPTIONAL MATCH path = (root)-[:HAS_TOPIC|HAS_PARAGRAPH|CITES*0..10]->(descendant)
            WITH root, collect(DISTINCT root) + collect(DISTINCT descendant) AS subgraph_nodes

            // Add any papers linked to referenced texts in the subgraph
            UNWIND subgraph_nodes AS node
            OPTIONAL MATCH (paper:Paper)-[:HAS_REFERENCE]->(node) WHERE node:ReferencedText
            WITH collect(DISTINCT node) + collect(DISTINCT paper) AS all_relevant_nodes_list

            UNWIND all_relevant_nodes_list AS n
            WITH collect(DISTINCT n) AS all_nodes_in_subgraph

            // Find all relevant relationships between nodes in the subgraph
            UNWIND all_nodes_in_subgraph AS n1
            UNWIND all_nodes_in_subgraph AS n2
            OPTIONAL MATCH (n1)-[r]->(n2)
            WHERE type(r) IN ['HAS_TOPIC', 'HAS_PARAGRAPH', 'CITES', 'HAS_REFERENCE'] // Only include relevant relationships
            WITH all_nodes_in_subgraph, collect(DISTINCT {
                startNodeElementId: elementId(n1),
                endNodeElementId: elementId(n2),
                type: type(r),
                properties: properties(r)
            }) AS subgraph_relationships

            // Return nodes and relationships
            UNWIND all_nodes_in_subgraph AS node
            RETURN collect({
                id: ID(node),
                elementId: elementId(node),
                labels: labels(node),
                properties: properties(node)
            }) AS nodes, subgraph_relationships AS relationships
        `;

        try {
            const records = await executeQuery(cypherQuery, { rootNodeId });
            
            if (!records || records.length === 0 || !records[0].has('nodes') || !records[0].has('relationships')) {
                console.warn('No data or invalid structure found for root node:', rootNodeId);
                return null;
            }

            const nodesData = records[0].get('nodes');
            const relationshipsData = records[0].get('relationships');

            if (!nodesData || nodesData.length === 0) {
                 console.warn('No nodes returned for root node:', rootNodeId);
                 return null;
            }

            // Create a map of all nodes returned by the query
            /** @type {Map<string, ProcessedGraphNode>} */
            const nodesMap = new Map();
            nodesData.forEach(nodeData => {
                const elementId = nodeData.elementId || `node-${nodeData.id}`;
                /** @type {ProcessedGraphNode} */
                const processedNode = {
                    id: elementId,
                    type: /** @type {NodeType} */ (nodeData.labels[0] || 'Unknown'),
                    properties: nodeData.properties || {},
                    children: /** @type {Array<ProcessedGraphNode>} */ ([]),
                    siblingOrder: parseFloat(nodeData.properties.siblingOrder) || null,
                    rtfLevel: 0, // Will be calculated later
                    title: nodeData.properties.name || nodeData.properties.Statement || nodeData.properties.title || 'Untitled',
                    textContent: nodeData.properties.text || ''
                };
                nodesMap.set(elementId, processedNode);
            });

            // Find the root node in the map
            const processedRoot = nodesMap.get(rootNodeId);
             if (!processedRoot) {
                 console.error(`Root node with ID ${rootNodeId} not found in processed nodes map.`);
                 return null;
             }


            // Build hierarchy based on relationships
            if (relationshipsData) {
                relationshipsData.forEach(rel => {
                    const startNode = nodesMap.get(rel.startNodeElementId);
                    const endNode = nodesMap.get(rel.endNodeElementId);

                    if (startNode && endNode) {
                        // Add child for hierarchical relationships
                        if (['HAS_TOPIC', 'HAS_PARAGRAPH'].includes(rel.type)) {
                             // Check if the child is already added to prevent duplicates
                             if (!startNode.children.find(child => child.id === endNode.id)) {
                                startNode.children.push(endNode);
                             }
                        }
                        // Handle CITES relationship (Paragraph -> ReferencedText)
                        if (rel.type === 'CITES' && startNode.type === 'Paragraph' && endNode.type === 'ReferencedText') {
                             // Ensure ReferencedText is a child of Paragraph for hierarchy
                             if (!startNode.children.find(child => child.id === endNode.id)) {
                                startNode.children.push(endNode);
                             }
                        }
                        // Handle HAS_REFERENCE relationship (ReferencedText -> Paper)
                        if (rel.type === 'HAS_REFERENCE' && startNode.type === 'ReferencedText' && endNode.type === 'Paper') {
                            startNode.properties.paperTitle = endNode.properties.title || 'Untitled Paper';
                        }
                    }
                });
            }

            // Calculate rtfLevel for all nodes starting from the root
            const calculateRtfLevels = (node, level) => {
                if (!node) return;
                node.rtfLevel = level;
                // For children of CentralTopic, their numbering level effectively starts at 0 for _getTopicNumber
                const nextLevel = (node.type === 'CentralTopic') ? 0 : level + 1;
                if (node.children) {
                    node.children.forEach(child => calculateRtfLevels(child, nextLevel));
                }
            };
            calculateRtfLevels(processedRoot, 0);

            // Sort children arrays of all nodes by siblingOrder
            nodesMap.forEach(node => {
                if (node.children.length > 0) {
                    node.children.sort((a, b) => {
                        const orderA = a.siblingOrder === null ? Infinity : a.siblingOrder;
                        const orderB = b.siblingOrder === null ? Infinity : b.siblingOrder;
                        return orderA - orderB;
                    });
                }
            });

            return processedRoot;

        } catch (error) {
            console.error('Error processing graph data:', error);
            return null;
        }
    }
}

class RtfBuilder {
    constructor() {
        this.rtfContent = [];
        this.topicCounters = [];
    }

    buildRtf(rootProcessedNode) {
        this.rtfContent = [];
        this.topicCounters = [];

        this.rtfContent.push('{\\rtf1\\ansi\\deff0\\nouicompat');
        this.rtfContent.push('{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}');
        this.rtfContent.push('{\\colortbl ;\\red0\\green0\\blue0;}');
        this.rtfContent.push('\\pard\\sa200\\sl276\\slmult1\\f0\\fs24');

        if (rootProcessedNode) {
            this._processNode(rootProcessedNode);
        }

        this.rtfContent.push('}');
        return this.rtfContent.join('\r\n');
    }

    _processNode(node) {
        let nodeOutput = '';
        const baseIndentSize = 720;
        const topicHangingIndent = -360;
        let currentIndent = 0;
        let paragraphFormatting = `\\pard\\sa200\\sl276\\slmult1\\f0\\fs24`;

        switch (node.type) {
            case 'CentralTopic':
                this.topicCounters = [];
                paragraphFormatting += `\\qc\\fs32\\b `;
                nodeOutput = `${this._escapeRtfText(node.title || 'Central Topic')}`;
                break;
            case 'Topic': {
                currentIndent = node.rtfLevel * baseIndentSize;
                const topicNumberStr = this._getTopicNumber(node.rtfLevel);
                paragraphFormatting += `\\li${currentIndent}\\fi${topicHangingIndent}\\b `;
                nodeOutput = `${topicNumberStr} ${this._escapeRtfText(node.title || 'Topic')}`;
                break;
            }
            case 'Paragraph': {
                currentIndent = ((node.rtfLevel - 1) * baseIndentSize) + baseIndentSize;
                const paragraphLabel = `Paragraph ${node.siblingOrder || 1}`;
                paragraphFormatting += `\\li${currentIndent}\\fs24 `;
                nodeOutput = `{\\b ${this._escapeRtfText(paragraphLabel)}: }${this._escapeRtfText(node.title || '')}`;
                break;
            }
            case 'ReferencedText': {
                currentIndent = ((node.rtfLevel - 2) * baseIndentSize) + (2 * baseIndentSize);
                const referenceLabel = `Reference ${node.siblingOrder || 1}`;
                let paperTitleRtf = '';
                if (node.properties.paperTitle) {
                    paperTitleRtf = ` (Paper: ${this._escapeRtfText(node.properties.paperTitle)})`;
                }
                paragraphFormatting += `\\li${currentIndent}\\fs24 `;
                const multiLineText = (node.textContent || '')
                    .split('\n')
                    .map(line => this._escapeRtfText(line))
                    .join('\\par\r\n' + paragraphFormatting);

                nodeOutput = `{\\i ${this._escapeRtfText(referenceLabel)}: }${multiLineText}${paperTitleRtf}`;
                break;
            }
            default:
                currentIndent = node.rtfLevel * baseIndentSize;
                paragraphFormatting += `\\li${currentIndent}\\fs20\\i `;
                nodeOutput = `(${this._escapeRtfText(node.type)}: ${this._escapeRtfText(node.title || node.id)})`;
        }

        this.rtfContent.push(`${paragraphFormatting}${nodeOutput}\\par`);

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => this._processNode(child));
        }
    }

    _getTopicNumber(topicRtfLevel) {
        while (this.topicCounters.length <= topicRtfLevel) {
            this.topicCounters.push(0);
        }

        this.topicCounters[topicRtfLevel]++;

        for (let i = topicRtfLevel + 1; i < this.topicCounters.length; i++) {
            this.topicCounters[i] = 0;
        }

        let numberStr = '';
        for (let i = 0; i <= topicRtfLevel; i++) {
            numberStr += (this.topicCounters[i] || 0) + '.';
        }
        return numberStr;
    }

    _escapeRtfText(text) {
        if (text === null || typeof text === 'undefined') return '';
        return text.toString().replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
    }
}

export const exportGraphToRtf = async (rootNodeId) => {
    if (!rootNodeId) {
        console.error('No rootNodeId provided for RTF export.');
        return;
    }

    const dataProcessor = new GraphDataProcessor();
    const rtfBuilder = new RtfBuilder();

    try {
        const processedRootNode = await dataProcessor.processGraphData(rootNodeId);

        if (!processedRootNode) {
            console.error('Failed to process graph data for RTF export.');
            return;
        }

        const rtfString = rtfBuilder.buildRtf(processedRootNode);
        const blob = new Blob([rtfString], { type: 'application/rtf' });
        const filename = `export-${processedRootNode.properties.name || rootNodeId}.rtf`
            .replace(/[^a-z0-9_.-]/gi, '_')
            .toLowerCase();

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error('Error during RTF export:', error);
    }
};