/// <reference types="nativewind/types" />

// Allow importing CSS files (global.css, CSS modules)
declare module "*.css" {
  const styles: Record<string, string>;
  export default styles;
}
