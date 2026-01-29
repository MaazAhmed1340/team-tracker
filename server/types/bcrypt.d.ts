declare module "bcrypt" {
  interface Bcrypt {
    hash(data: string, saltRounds: number): Promise<string>;
    compare(data: string, encrypted: string): Promise<boolean>;
  }
  const bcrypt: Bcrypt;
  export = bcrypt;
}
