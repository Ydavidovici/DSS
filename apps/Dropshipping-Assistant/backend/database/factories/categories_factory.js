// backend/database/factories/categories_factory.js

const faker = require('faker');

const createCategory = () => {
    return {
        name: faker.commerce.department(),
        description: faker.lorem.sentence(),
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createCategory };
