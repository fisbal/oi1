/** Today's date as YYYY-MM-DD in the device's own time zone. Never use toISOString().slice(0, 10) for a
 *  date people see: that is the UTC day, already "tomorrow" every evening in America (Toronto after 19:00). */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
