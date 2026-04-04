#import <CoreText/CoreText.h>
#import <Foundation/Foundation.h>

int main(void) {
  @autoreleasepool {
    CFArrayRef familyNamesRef = CTFontManagerCopyAvailableFontFamilyNames();
    NSArray<NSString *> *familyNames = CFBridgingRelease(familyNamesRef);
    NSMutableOrderedSet<NSString *> *uniqueNames = [NSMutableOrderedSet orderedSet];

    for (id value in familyNames) {
      if (![value isKindOfClass:[NSString class]]) {
        continue;
      }

      NSString *trimmed = [(NSString *)value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      if (trimmed.length == 0) {
        continue;
      }

      [uniqueNames addObject:trimmed];
    }

    NSArray<NSString *> *sortedNames = [[uniqueNames array] sortedArrayUsingSelector:@selector(localizedCaseInsensitiveCompare:)];

    for (NSString *familyName in sortedNames) {
      fprintf(stdout, "%s\n", familyName.UTF8String);
    }
  }

  return 0;
}
