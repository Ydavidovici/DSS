// backend/database/factories/product_scores_factory.js

const faker = require('faker');

const createProductScore = () => {
    const demand = faker.datatype.number({ min: 0, max: 100 });
    const competition = faker.datatype.number({ min: 0, max: 100 });
    const profit_margin = faker.datatype.number({ min: 0, max: 100 });
    const shipping_handling = faker.datatype.number({ min: 0, max: 100 });
    const return_rate = faker.datatype.number({ min: 0, max: 100 });
    const seasonality = faker.datatype.number({ min: 0, max: 100 });
    const product_restrictions = faker.datatype.number({ min: 0, max: 100 });

    const total_score = Math.round(
        (demand * 0.2) +
        (competition * 0.15) +
        (profit_margin * 0.2) +
        (shipping_handling * 0.1) +
        (return_rate * 0.05) +
        (seasonality * 0.1) +
        (product_restrictions * 0.05)
    );

    return {
        demand,
        competition,
        profit_margin,
        shipping_handling,
        return_rate,
        seasonality,
        product_restrictions,
        total_score,
        created_at: new Date(),
        updated_at: new Date(),
    };
};

module.exports = { createProductScore };
