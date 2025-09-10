/**
 *
 * @param {number} bytes
 * @param {number} fractionDigits
 */
export function fmtBytes(bytes, fractionDigits) {
  if (bytes === 0) {
    return "0B";
  }
  fractionDigits = Math.max(0, fractionDigits);
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return Number.parseFloat((bytes / Math.pow(1024, i)).toFixed(fractionDigits)) + sizes[i];
}

/**
 *
 * @param {number | Date} date
 */
export function fmtDate(date) {
  if (typeof date === "number") {
    date = new Date(date);
  }

  return date.toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "full",
    timeStyle: "medium",
    hourCycle: "h24",
  });
}

export function camel2snake(obj) {
  const snackObj = {};
  for (const key in obj) {
    const snackKey = key
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
    snackObj[snackKey] = obj[key];
  }
  return snackObj;
}

export function snack2camel(obj) {
  const camelObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = obj[key];
  }
  return camelObj;
}

export function getFileType(extName) {
  //! "jpg".split(".").at(-1)?.toLowerCase();     --> "jpg"
  //! ".jpg".split(".").at(-1)?.toLowerCase();    --> "jpg"
  //! "a.jpg".split(".").at(-1)?.toLowerCase();   --> "jpg"
  //! "a.b.jpg".split(".").at(-1)?.toLowerCase(); --> "jpg"
  switch (extName) {
    case "avi":
    case "flv":
    case "mov":
    case "mp4":
      return "video";

    case "gif":
    case "jpeg":
    case "jpg":
    case "png":
    case "svg":
    case "webp":
      return "image";

    default:
      return "file";
  }
}
