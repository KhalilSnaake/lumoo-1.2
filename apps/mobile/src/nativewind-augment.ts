// Re-export to make this file a module, enabling declare module augmentation
export {};

// Apply nativewind className augmentation for TypeScript
// This is needed because react-native-css-interop/types.d.ts module augmentation
// doesn't properly merge with react-native@0.81+ types when loaded via /// <reference>
declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ScrollViewProps {
    contentContainerClassName?: string;
  }
  interface FlatListProps<ItemT> {
    contentContainerClassName?: string;
    columnWrapperClassName?: string;
  }
  interface TextInputProps {
    className?: string;
    placeholderClassName?: string;
  }
}
