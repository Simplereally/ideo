import { GoogleGenAI } from '@google/genai';
type Options = Parameters<GoogleGenAI['models']['generateImages']>[0];
type Config = Options['config'];
