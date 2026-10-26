import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);

// Android home-screen widgets draw from a headless JS task.
if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { widgetTaskHandler } = require('./src/widgets/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
