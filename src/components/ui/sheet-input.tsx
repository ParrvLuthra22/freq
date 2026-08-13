import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Platform, TextInput } from 'react-native';

/**
 * The text input to use inside a bottom sheet.
 *
 * Two different bugs, one component:
 *
 * - On native, a plain `TextInput` inside a sheet is covered by the keyboard
 *   the moment it focuses, because the sheet does not know to move.
 *   `BottomSheetTextInput` is what tells it to.
 * - On web, `BottomSheetTextInput` reaches into RN internals that
 *   react-native-web does not implement (`TextInput.State.currentlyFocusedInput`)
 *   and throws outright on render.
 *
 * So each platform gets the one that works, and call sites just use this.
 */
const SheetInput = Platform.OS === 'web' ? TextInput : BottomSheetTextInput;

export { SheetInput };
