import { z } from "zod";

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const LogoutSchema = z.object({
  email: z.email(),
});

const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  avatar: z.string().min(1),
});

const UpdatePwdSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const UpdateUserInfoSchema = z.object({
  email: z.email(),
  avatar: z.string().optional(),
  username: z.string().optional(),
  signature: z.string().optional(),
});

export const CreateGroupSchema = z.object({
  groupName: z.string().min(1),
  groupAvatar: z.string().min(1),
  readme: z.string().optional(),
  memberList: z.array(
    z.object({
      userId: z.number(),
      email: z.email(),
      avatar: z.string(),
    }),
  ),
});

export const AddFriends2GroupSchema = z.object({
  groupId: z.number().int().positive(),
  friendList: z.array(
    z.object({
      userId: z.number(),
      email: z.email(),
    }),
  ),
});

export const AddSelf2GroupSchema = z.object({
  groupId: z.number().int().positive(),
});

export const FindFriendByEmailSchema = z.object({
  email: z.email(),
});

export const FindFriendByIdQuerySchema = z.object({
  id: z.string().min(1).optional(),
});

export const AddFriendSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  avatar: z.string().min(1),
});

export const AddTagSchema = z.object({
  name: z.string().min(1),
});

export const UpdateFriendSchema = z.object({
  friendId: z.number().int().positive(),
  noteName: z.string().optional(),
  tagId: z.number().int().positive().optional(),
});

export const VerifyFileSchema = z.object({
  fileHash: z.string().min(1),
  chunkCnt: z.number().int().nonnegative(),
  extName: z.string().min(1),
});

export const UploadChunkBodySchema = z.object({
  chunkIdx: z.string().min(1).or(z.number()),
  fileHash: z.string().min(1),
  extName: z.string().min(1),
});

export const MergeChunksSchema = z.object({
  fileHash: z.string().min(1),
  extName: z.string().min(1),
});

export const JwtUserInfoSchema = z.object({
  id: z.number(),
  email: z.email(),
  password: z.string(),
  username: z.string(),
  avatar: z.string(),
  signature: z.string().default(""),
});

export const RtcMessageSchema = z.object({
  cmd: z.enum(["createRtcRoom", "addPeer", "offer", "answer", "iceCandidate", "reject"]),
  mode: z.enum(["friendAudio", "friendVideo", "groupAudio", "groupVideo"]).optional(),
  data: z.any().optional(),
  receiver: z.string().optional(),
  receiverList: z
    .array(
      z.object({
        email: z.email(),
        alias: z.string().optional(),
        avatar: z.string().optional(),
      }),
    )
    .optional(),
  roomKey: z.string().optional(),
  sender: z.string().optional(),
});

export const FetchGroupMembersQuerySchema = z.object({
  groupId: z.string().min(1).optional(),
  roomKey: z.string().min(1).optional(),
});

export const SearchGroupByNameQuerySchema = z.object({
  name: z.string().min(1).optional(),
});

export const DeleteFriendQuerySchema = z.object({
  id: z.string().min(1).optional(),
});

export const ChatMessageSchema = z.object({
  senderId: z.number(),
  receiverId: z.number(),
  content: z.string(),
  roomKey: z.string(),
  avatar: z.string().optional(),
  mediaType: z.enum(["text", "image", "video", "file"]),
  fileSize: z.union([z.number(), z.string()]).optional(),
  createdAt: z.string().optional(),
  nickname: z.string().optional(),
});

export const WsChatQueryParamsSchema = z.object({
  roomKey: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  type: z.enum(["friend", "group"]).optional(),
});

export const DbConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export { LoginSchema, LogoutSchema, RegisterSchema, UpdatePwdSchema, UpdateUserInfoSchema };
