/**
 * exclude array member from array
 * @param arr
 * @param excludeArr 
 * @returns 
 */
export const arrayExclude = (arr: any[], excludeArr: any[]) => {
  return arr.filter((item) => !excludeArr.includes(item))
}
