import dayjs from 'dayjs';

enum MsgClass {
  NewMsg = 1,
  TodayMsg,
  YesterdayMsg,
  YearMsg,
  OtherMsg,
}

function getMsgType(
  dateLike: number /** timestamp */ | string /** e.g. ISOString */ | Date /** date */,
): MsgClass {
  const day = dayjs(new Date(dateLike));
  const nowDay = dayjs(new Date());
  if (nowDay.year() - day.year() >= 1) {
    return MsgClass.OtherMsg;
  }
  if (nowDay.month() - day.month() >= 1 || nowDay.date() - day.date() >= 2) {
    return MsgClass.YearMsg;
  }
  if (nowDay.date() - day.date() >= 1) {
    // < 2
    return MsgClass.YesterdayMsg;
  }
  if (nowDay.hour() - day.hour() >= 1 || nowDay.minute() - day.minute() >= 5) {
    return MsgClass.TodayMsg;
  }
  return MsgClass.NewMsg;
}

export function fmtTime4list(dateLike: number | string | Date): string {
  const type = getMsgType(dateLike);
  const day = dayjs(dateLike);
  switch (type) {
    case MsgClass.NewMsg:
      return '刚刚';
    case MsgClass.TodayMsg:
      return day.format('H:mm');
    case MsgClass.YesterdayMsg:
      return '昨天';
    case MsgClass.YearMsg:
      return day.format('M月D日');
    case MsgClass.OtherMsg:
      return day.format('YYYY年M月D日');
  }
}

export function fmtTime4chat(dateLike: number | string | Date): string {
  const type = getMsgType(dateLike);
  // const day = dayjs(dateLike);
  switch (type) {
    case MsgClass.NewMsg:
      return '刚刚';
    case MsgClass.TodayMsg:
      return dayjs(dateLike).format('H:mm');
    case MsgClass.YesterdayMsg:
      return dayjs(dateLike).format('昨天 H:mm');
    case MsgClass.YearMsg:
      return dayjs(dateLike).format('M月D日 AH:mm').replace('AM', '上午').replace('PM', '下午');
    case MsgClass.OtherMsg:
      return dayjs(dateLike)
        .format('YYYY年M月D日 AH:mm')
        .replace('AM', '上午')
        .replace('PM', '下午');
  }
}

export function fmtTime4call(duration: number): string {
  const pad0 = (num: number) => num.toString().padStart(2, '0');
  const h = Math.floor(duration / 3600);
  const m = Math.floor((duration % 3600) / 60);
  const s = duration % 60;
  return `${pad0(h)}:${pad0(m)}:${pad0(s)}`;
}
