import Router from "@koa/router";
import auth from "../utils/auth.js";
import {
  createGroup,
  findGroupByName,
  addFriends2group,
  addSelf2group,
  findGroupMembers,
  findGroupById,
  findGroupListByUserId,
} from "../service/group.js";
import type { AppContext } from "../types.js";

const router = new Router<unknown, AppContext>();

export default function createGroupRouter(): Router<unknown, AppContext> {
  // /api/v1/group/list
  router.get("/list", auth, findGroupListByUserId);
  // /api/v1/group/name
  router.get("/name", auth, findGroupByName);
  // /api/v1/group/id
  router.get("/id", auth, findGroupById);
  // /api/v1/group/create
  router.post("/create", auth, createGroup);
  // /api/v1/group/add-friends
  router.post("/add-friends", auth, addFriends2group);
  // /api/v1/group/add-self
  router.post("/add-self", auth, addSelf2group);
  // /api/v1/group/members
  router.get("/members", auth, findGroupMembers);
  return router;
}
