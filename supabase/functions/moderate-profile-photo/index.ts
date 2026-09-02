import '@supabase/functions-js/edge-runtime.d.ts';
import { handleModerateImage } from '../_shared/moderate-image.ts';

// Backward-compatible alias for builds that still call the old endpoint. New
// clients use moderate-image with purpose: "profile-photo".
Deno.serve((req: Request) => handleModerateImage(req, 'profile-photo'));
