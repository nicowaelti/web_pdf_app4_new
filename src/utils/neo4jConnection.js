import neo4j from 'neo4j-driver';

const neo4jUri = 'bolt://localhost:7689';
const neo4jUser = 'neo4j';
const neo4jPassword = 'password.neo4j';

let driver = null;

export const initializeDriver = () => {
    try {
        driver = neo4j.driver(
            neo4jUri,
            neo4j.auth.basic(neo4jUser, neo4jPassword),
            {
                maxConnectionPoolSize: 50,
                connectionTimeout: 5000
            }
        );
        console.log('Neo4j driver initialized');
        return driver;
    } catch (error) {
        console.error('Error initializing Neo4j driver:', error);
        throw error;
    }
};

export const getDriver = () => {
    if (!driver) {
        return initializeDriver();
    }
    return driver;
};

export const closeDriver = async () => {
    if (driver) {
        await driver.close();
        driver = null;
        console.log('Neo4j driver closed');
    }
};

// Utility function to execute queries
export const executeQuery = async (cypher, params = {}) => {
    const session = getDriver().session();
    try {
        const result = await session.run(cypher, params);
        return result.records;
    } catch (error) {
        console.error('Error executing query:', error);
        throw error;
    } finally {
        await session.close();
    }
};