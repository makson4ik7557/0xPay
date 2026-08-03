import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';

describe('testcontainers postgres', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17').start();
  }, 60000);

  afterAll(async () => {
    await container.stop();
  });

  it('connects and runs a query', async () => {
    const client = new Client({
      connectionString: container.getConnectionUri(),
    });
    await client.connect();
    const result = await client.query('SELECT 1 as value');
    expect(result.rows[0].value).toBe(1);
    await client.end();
  });
});
