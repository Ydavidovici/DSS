// test/authService.test.js
import axios from 'axios';
import assert from 'assert';

type JWKS = { keys: Array<Record<string, any>> };

async function testJWKS() {
    console.log('Testing JWKS endpoint...');
    const resp = await axios.get(`${AUTH_URL}/.well-known/jwks.json`);
    assert.strictEqual(resp.status, 200, 'JWKS endpoint should return 200');
    const data: JWKS = resp.data;
    assert.ok(Array.isArray(data.keys), 'JWKS should have a keys array');
    console.log('JWKS:', data);
}

async function testLogin() {
    console.log('Testing /auth/login...');
    const resp = await axios.post(
        `${AUTH_URL}/auth/login`,
        { username: TEST_USERNAME, password: TEST_PASSWORD }
    );
    assert.strictEqual(resp.status, 200, 'Login should return 200');
    const token = resp.data.token;
    assert.ok(token, 'Token should be present');
    console.log('Login successful, token:', token.substring(0, 20) + '...');
    return token;
}

async function testVerify(token) {
    console.log('Testing /auth/verify...');
    const resp = await axios.get(
        `${AUTH_URL}/auth/verify`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    assert.strictEqual(resp.status, 200, 'Verify should return 200');
    const payload = resp.data.user;
    assert.strictEqual(payload.username, TEST_USERNAME, 'Payload username should match');
    console.log('Verify successful, payload:', payload);
}

// Configuration from environment or defaults
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
const TEST_USERNAME = process.env.TEST_USERNAME || 'testuser';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword';

(async () => {
    try {
        await testJWKS();
        const token = await testLogin();
        await testVerify(token);
        console.log('🎉 All tests passed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
})();
