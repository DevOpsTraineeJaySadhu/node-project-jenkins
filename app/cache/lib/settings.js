/* eslint-disable no-async-promise-executor */
const { Setting } = require('../../models');
const { redis } = require('../../utils');

const operations = {};

operations.getSettings = async (query, project, callback) =>
    new Promise(async (resolve, reject) => {
        const settings = await redis.getAsync('ludo:settings');
        if (settings) return callback ? callback(null, _.pick(settings, Object.keys(project))) : resolve(_.pick(settings, Object.keys(project))); // based on project properties

        Setting.findOne(query, async (error, response) => {
            if (error) return callback ? callback(error) : reject(error);
            if (!response) return callback ? callback() : resolve();

            redis.setDataWithExpiry('ludo:settings', response, 1 * 1 * 60);
            return callback ? callback(null, _.pick(response, Object.keys(project))) : resolve(_.pick(response, Object.keys(project)));
        }).lean();
    });

module.exports = operations;
