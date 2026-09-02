import '@supabase/functions-js/edge-runtime.d.ts';
import { handleModerateImage } from '../_shared/moderate-image.ts';

Deno.serve((req: Request) => handleModerateImage(req));
