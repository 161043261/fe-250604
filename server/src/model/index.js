import mysql from "mysql";
import fs from "node:fs";
import path from "node:path";

//! mysql:8.4
// docker exec -it mysql_container bash
// docker logs --follow mysql_container
// alter user 'root' identified with mysql_native_password BY 'pass';
// flush privileges;
// create database db0;
let conf = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "pass",
  database: "db0",
};
const confPath = path.join(process.cwd(), "./conf.json");
if (fs.existsSync(confPath)) {
  const conf2 = JSON.parse(fs.readFileSync(confPath, { encoding: "utf-8" }));
  conf = { ...conf, ...conf2 };
} else {
  console.warn(`[server] ${path.join(process.cwd(), "./conf.json")} not found`);
}

const pool = mysql.createPool({
  ...conf,
  multipleStatements: true,
  charset: "utf8mb4",
});

function createUsers() {
  const sql = `
-- 用户表
create table if not exists users
(
  -- 用户 ID
  id         int(31)      not null auto_increment primary key,
  -- 用户邮箱
  email      varchar(255) not null unique,
  -- 用户密码
  password   varchar(255) not null,
  -- 用户名
  username   varchar(255) null,
  -- 用户头像
  avatar     longtext     null,
  -- 签名
  signature  longtext     null,
  created_at datetime  default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

function createFriends() {
  const sql = `
-- 好友表
create table if not exists friends
(
  -- 好友 ID
  id         int(31)      not null auto_increment primary key,
  -- 好友的用户 ID
  user_id    int(31)      not null,
  -- 好友邮箱
  email      varchar(255) not null,
  -- 好友头像
  avatar     longtext     null,
  -- 好友备注
  note_name  varchar(255),
  -- 好友的标签 ID
  tag_id     int(31),
  -- 好友状态
  state      enum ('online', 'offline') default 'offline',
  -- 未读消息数
  unread_cnt int(31)                    default 0,
  -- 房间号
  room_key   varchar(255),
  created_at timestamp                  default current_timestamp,
  updated_at timestamp                  default current_timestamp on update current_timestamp,
  index idx_tag_id (tag_id),
  foreign key (tag_id) references tags (id) on delete set null
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

function createTags() {
  const sql = `
-- 标签表
create table if not exists tags
(
  -- 标签 ID
  id         int(31)      not null auto_increment primary key,
  -- 该标签所属用户的 ID
  user_id    int(31)      not null,
  -- 该标签所属用户的邮箱
  user_email varchar(255) not null,
  -- 标签名
  name       varchar(255) not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index idx_user_id (user_id),
  foreign key (user_id) references users (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
    createFriends();
    createGroups();
  });
}

function createGroups() {
  const sql = `
-- 群聊表
create table if not exists \`groups\`
(
  -- 群聊 ID
  id         int(31)      not null auto_increment primary key,
  -- 群聊名
  name       varchar(255) not null,
  -- 群主的用户 ID
  creator_id   int(31)      not null,
  -- 房间号
  room_key   varchar(255) not null unique,
  -- 群聊头像
  avatar     longtext,
  -- 群公告
  readme     text,
  -- 未读消息数
  unread_cnt int(31)   default 0,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index idx_creator_id (creator_id),
  foreign key (creator_id) references users (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
    createGroupMembers();
  });
}

function createGroupMembers() {
  const sql = `
-- 群聊成员表
create table if not exists group_members
(
  -- 成员 ID
  id         int(31)      not null auto_increment primary key,
  -- 群昵称
  nickname   varchar(255) not null,
  -- 群聊 ID
  group_id   int(31)      not null,
  -- 成员的用户 ID
  user_id    int(31)      not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  index idx_group_id (group_id),
  index idx_user_id (user_id),
  foreign key (group_id) references \`groups\` (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

function createMessages() {
  const sql = `
-- 消息表
create table if not exists messages
(
  -- 消息 ID
  id          int(31)                                 not null auto_increment primary key,
  -- 发送者的用户 ID
  sender_id   int(31)                                 not null,
  -- 接收者的用户 ID
  receiver_id int(31)                                 not null,
  -- 消息内容
  content     longtext                                not null,
  -- 房间号
  room_key    varchar(255)                            not null,
  -- 消息类型
  type        enum ('friend', 'group')              not null,
  -- 媒体类型
  media_type  enum ('text', 'image', 'video', 'file') not null,
  -- 文件大小, 单位 B
  file_size   int(31)                                 null     default 0,
  -- 消息状态
  state       int(1)                                  not null default 0,
  created_at  timestamp                                        default current_timestamp,
  foreign key (sender_id) references users (id) on delete cascade on update cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
    createMsgStats();
  });
}

function createMsgStats() {
  const sql = `
-- 消息统计表
create table if not exists msg_stats
(
  -- 消息统计 ID
  id         int(31)      not null auto_increment,
  -- 房间号
  room_key   varchar(255) not null,
  -- 消息总数
  total      int(255)     not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  primary key (id)
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_unicode_ci;
`;
  pool.query(sql, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

pool.query("select 1", (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  createUsers();
  createTags();
  createMessages();
});

export default pool;
