import { uuid } from 'expo';

import { installNativeAuthRuntime } from '@/utils/native-auth-runtime';

installNativeAuthRuntime(uuid.v4);
