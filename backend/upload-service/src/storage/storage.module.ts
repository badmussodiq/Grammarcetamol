import { Global, Module } from '@nestjs/common';
import { StorageProviderRegistry } from './storage-provider.registry';

@Global()
@Module({
  providers: [StorageProviderRegistry],
  exports: [StorageProviderRegistry],
})
export class StorageModule {}
