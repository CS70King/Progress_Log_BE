import { env } from '../config/env';
import { mockStorage } from './mockStorage';
import { supabaseStorage } from './supabaseStorage';

export const storageDriver = env.STORAGE_DRIVER;
export const storage = storageDriver === 'mock' ? mockStorage : supabaseStorage;
