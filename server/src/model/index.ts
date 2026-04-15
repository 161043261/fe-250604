import knex, { type Knex } from "knex";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DbConfigSchema } from "../schema/index.js";

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

let conf: DbConfig = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "pass",
  database: "fe_250604",
};

const confPath = join(process.cwd(), "./conf.json");
if (existsSync(confPath)) {
  const parsed = JSON.parse(readFileSync(confPath, { encoding: "utf-8" }));
  const result = DbConfigSchema.partial().safeParse(parsed);
  if (result.success) {
    conf = { ...conf, ...result.data };
  }
} else {
  console.warn(`[server] ${join(process.cwd(), "./conf.json")} not found`);
}

const db: Knex = knex({
  client: "mysql2",
  connection: {
    ...conf,
    charset: "utf8mb4",
  },
  pool: { min: 0, max: 10 },
});

async function ensureTable(
  tableName: string,
  create: (table: Knex.CreateTableBuilder) => void,
): Promise<void> {
  const exists = await db.schema.hasTable(tableName);
  if (exists) return;
  await db.schema.createTable(tableName, (table: Knex.CreateTableBuilder) => {
    table.engine("InnoDB");
    table.charset("utf8mb4");
    table.collate("utf8mb4_unicode_ci");
    create(table);
  });
}

async function initSchema(): Promise<void> {
  try {
    await db.raw("select 1");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  await ensureTable("users", (table) => {
    table.increments("id").primary();
    table.string("email", 255).notNullable().unique();
    table.string("password", 255).notNullable();
    table.string("username", 255).nullable();
    table.text("avatar", "longtext").nullable();
    table.text("signature", "longtext").nullable();
    table.dateTime("created_at").defaultTo(db.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(db.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
  });

  await ensureTable("tags", (table) => {
    table.increments("id").primary();
    table.integer("user_id").notNullable().index("idx_user_id");
    table.string("user_email", 255).notNullable();
    table.string("name", 255).notNullable();
    table.timestamp("created_at").defaultTo(db.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(db.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
    table.foreign("user_id").references("users.id").onDelete("CASCADE");
  });

  await ensureTable("groups", (table) => {
    table.increments("id").primary();
    table.string("name", 255).notNullable();
    table.integer("creator_id").notNullable().index("idx_creator_id");
    table.string("room_key", 255).notNullable().unique();
    table.text("avatar", "longtext").nullable();
    table.text("readme", "text").nullable();
    table.integer("unread_cnt").notNullable().defaultTo(0);
    table.timestamp("created_at").defaultTo(db.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(db.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
    table.foreign("creator_id").references("users.id").onDelete("CASCADE");
  });

  await ensureTable("friends", (table) => {
    table.increments("id").primary();
    table.integer("user_id").notNullable();
    table.string("email", 255).notNullable();
    table.text("avatar", "longtext").nullable();
    table.string("note_name", 255).nullable();
    table.integer("tag_id").nullable().index("idx_tag_id");
    table.enu("state", ["online", "offline"]).defaultTo("offline");
    table.integer("unread_cnt").notNullable().defaultTo(0);
    table.string("room_key", 255).nullable();
    table.timestamp("created_at").defaultTo(db.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(db.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
    table.foreign("tag_id").references("tags.id").onDelete("SET NULL");
  });

  await ensureTable("group_members", (table) => {
    table.increments("id").primary();
    table.string("nickname", 255).notNullable();
    table.integer("group_id").notNullable().index("idx_group_id");
    table.integer("user_id").notNullable().index("idx_user_id");
    table.timestamp("created_at").defaultTo(db.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(db.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
    table.foreign("group_id").references("groups.id").onDelete("CASCADE");
  });

  await ensureTable("messages", (table) => {
    table.increments("id").primary();
    table.integer("sender_id").notNullable();
    table.integer("receiver_id").notNullable();
    table.text("content", "longtext").notNullable();
    table.string("room_key", 255).notNullable();
    table.enu("type", ["friend", "group"]).notNullable();
    table.enu("media_type", ["text", "image", "video", "file"]).notNullable();
    table.integer("file_size").nullable().defaultTo(0);
    table.integer("state").notNullable().defaultTo(0);
    table.timestamp("created_at").defaultTo(db.fn.now());
    table
      .foreign("sender_id")
      .references("users.id")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
  });

  await ensureTable("msg_stats", (table) => {
    table.increments("id").primary();
    table.string("room_key", 255).notNullable();
    table.integer("total").notNullable();
    table.timestamp("created_at").defaultTo(db.fn.now());
    table
      .timestamp("updated_at")
      .defaultTo(db.raw("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"));
  });
}

void initSchema();

export default db;
