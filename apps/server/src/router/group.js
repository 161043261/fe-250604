import { Router } from "express";
import auth from "../utils/auth.js";
import {
  createGroup,
  findGroupListByUserId, // userId
  findGroupListByName, // groupName
  findGroupById, // groupId
  addFriends2group,
  addSelf2group,
  findGroupMembers,
} from "../service/group.js";
const router = Router();

export default function createGroupRouter() {
  //! /api/v1/group/list
  router.get("/list", auth, findGroupListByUserId);
  //! /api/v1/group/name
  router.get("/name", auth, findGroupListByName);
  //! /api/v1/group/id
  router.get("/id", auth, findGroupById);
  //! /api/v1/group/create
  router.post("/create", auth, createGroup);
  //! /api/v1/group/add-friends
  router.post("/add-friends", auth, addFriends2group);
  //! /api/v1/group/add-self
  router.post("/add-self", auth, addSelf2group);
  //! /api/v1/group/members
  router.get("/members", auth, findGroupMembers);
  return router;
}
