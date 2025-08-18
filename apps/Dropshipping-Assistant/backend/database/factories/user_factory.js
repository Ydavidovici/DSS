// backend/database/factories/user_factory.js

const faker = require('faker');
const bcrypt = require('bcrypt');

const createUser = async () => {
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    return {
        username: faker.internet.userName(),
        email: faker.internet.email(),
        password_hash: passwordHash,
        role: faker.random.arrayElement(['admin', 'customer']),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createUser };
