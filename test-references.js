import { executeQuery } from './src/utils/neo4jConnection.js';

async function checkReferenceNodes() {
    try {
        // First initialize the connection
        await executeQuery('MATCH (n) RETURN n LIMIT 1');
        
        // Query to find all nodes and their relationships
        const result = await executeQuery('MATCH (n) RETURN n, labels(n), properties(n)');
        
        console.log('Found nodes:', result.length);
        result.forEach(record => {
            const labels = record.get('labels(n)');
            const props = record.get('properties(n)');
            console.log('\nNode:', {
                labels: labels,
                properties: props
            });
        });
    } catch (error) {
        console.error('Error checking reference nodes:', error);
    }
}

checkReferenceNodes();