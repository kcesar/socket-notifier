export default class Utils {
  static fromMultiValue(str: string|string[]|undefined) {
    return Array.isArray(str) ? str[0] : str;
  }
}
