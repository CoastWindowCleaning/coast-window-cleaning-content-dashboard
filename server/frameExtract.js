// Best-effort still-frame grab for an already-uploaded Cloudinary video, used
// to give the caption agent a real look at the footage. Uses Cloudinary's
// on-the-fly video-to-image transformation (a plain URL fetch) rather than
// shelling out to ffmpeg -- that keeps this working identically on a local
// machine and on serverless hosts like Vercel, with no binary dependency to
// go stale or fail to run in a given environment.
async function fetchFrameBase64FromCloudinary(cloudName, publicId) {
  if (!cloudName || !publicId) return null;
  const url = 'https://res.cloudinary.com/' + cloudName + '/video/upload/so_1.0,w_512,f_jpg/' + publicId + '.jpg';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf.toString('base64');
  } catch (e) {
    console.warn('Frame fetch from Cloudinary skipped (non-fatal):', e.message);
    return null;
  }
}

module.exports = { fetchFrameBase64FromCloudinary };
