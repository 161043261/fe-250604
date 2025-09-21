import express from "express";
import auth from "../utils/auth.js";
import {
  addFriend,
  addTag,
  findFriendList,
  findTagList,
  findFriendById,
  findFriendListByEmail,
  updateFriend,
} from "../service/friend.js";
const router = express.Router();

export default function createFriendRouter() {
  //! /api/v1/friend/email
  router.get("/email", auth, findFriendListByEmail);
  //! /api/v1/friend/add
  router.post("/add", auth, addFriend);
  //! /api/v1/friend/list
  router.get("/list", auth, findFriendList);
  //! /api/v1/friend/id
  router.get("/id", auth, findFriendById);
  //! /api/v1/friend/tag-list
  router.get("/tag-list", auth, findTagList);
  //! /api/v1/friend/add-tag
  router.post("/add-tag", auth, addTag);
  //! /api/v1/friend/update
  router.post("/update", auth, updateFriend);
  return router;
}
