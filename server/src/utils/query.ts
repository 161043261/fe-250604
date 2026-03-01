import pool from "../model/index.js";

export default function query<T = unknown>(sql: string, values?: unknown): Promise<T> {
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
        return resolve(results as T);
      },
    );
  });
}
