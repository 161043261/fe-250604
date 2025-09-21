import pool from "../model/index.js";

/**
 *
 * @param {string} sql
 * @param {any} values
 */
export default function query(sql, values) {
  return new Promise((resolve, reject) => {
    pool.query(
      {
        sql,
        values,
      },
      (err, results) => {
        if (err) {
          return reject(err);
        }
        return resolve(results);
      },
    );
  });
}
