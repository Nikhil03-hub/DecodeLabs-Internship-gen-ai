"""
studio.py — Image Studio Configuration
========================================
Aspect ratios, style presets, and payload builder for Week 3.
"""
from __future__ import annotations

# PDF-specified aspect ratios → exact dimensions (R2)
ASPECT_RATIOS: dict[str, tuple[int, int]] = {
    "1:1":  (1024, 1024),   # logos, avatars, profile pics
    "16:9": (1344, 768),    # YouTube thumbnails, website banners
    "9:16": (768, 1344),    # Instagram Reels, TikTok, Shorts
}

# Style preset prompts appended to user prompt (R8)
STYLE_PRESETS: dict[str, str] = {
    "None":         "",
    "Cyberpunk":    ", cyberpunk neon aesthetic, dystopian city, electric blue and magenta palette, rain-slicked streets",
    "Minimalism":   ", minimalist composition, clean white background, simple geometric shapes, elegant negative space",
    "Photoreal":    ", photorealistic, DSLR photography, sharp focus, natural lighting, 8k resolution",
    "Anime":        ", anime art style, Studio Ghibli inspired, vibrant colors, detailed illustration",
    "3D Render":    ", 3D render, octane renderer, subsurface scattering, depth of field, studio lighting",
    "Oil Painting": ", oil painting, impressionist style, thick brushstrokes, rich textures, museum quality",
}


def build_payload(
    prompt: str,
    aspect_ratio: str,
    style: str,
    negative_prompt: str = "",
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    seed: int | None = None,
) -> dict:
    """
    Build the Hugging Face inference payload (R2).

    NOTE: Some HF serverless models clamp width/height to 1024.
    If the API rejects custom dimensions, fall back to 1024×1024.
    The actual resolution used is returned in the response.
    """
    w, h = ASPECT_RATIOS.get(aspect_ratio, (1024, 1024))
    style_suffix = STYLE_PRESETS.get(style, "")
    full_prompt = prompt.strip() + style_suffix

    payload: dict = {
        "inputs": full_prompt,
        "parameters": {
            "negative_prompt": negative_prompt or "blurry, low quality, distorted, ugly, watermark",
            "width":  w,
            "height": h,
            "guidance_scale": guidance_scale,
            "num_inference_steps": num_inference_steps,
        },
    }

    if seed is not None:
        payload["parameters"]["seed"] = seed

    return payload
