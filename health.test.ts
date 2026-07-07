import request from 'supertest';
import {test,expect} from "vitest";
import app from "./app.js"

test('GET /health → 200 і { status: ok }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: "ok"});
});