# Week 3 Screenshot Plan

## Screenshots to capture for submission

1. **Studio overview** — full studio with prompt "glowing crystal forest at midnight", Cyberpunk style selected, 4 images generated in gallery
2. **Aspect ratios** — 16:9 selected, landscape images in gallery showing 1344×768 dimensions in footer
3. **Advanced settings open** — collapsible panel expanded showing guidance/steps/seed controls
4. **Lightbox** — click any image to see it full-screen with backdrop blur
5. **Reliability status** — trigger model loading 503; show "model warmed up in ~20s" line in gallery header
6. **History sidebar** — populated with 5+ previous prompts, thumbnail previews visible
7. **Zip export** — "Download all" button clicked, browser download dialog visible with `generated-images.zip`
8. **Style comparison** — 4 tiles visible: None / Cyberpunk / Anime / Oil Painting for same prompt

## Terminal evidence

```bash
# Show chunked save + Pillow validation
python -c "from storage import save_stream, validate; import os; d=open('test.png','rb').read(); p=save_stream(d); print(validate(p))"

# Show retry backoff code
grep -n "BACKOFF\|timeout\|sleep" image_client.py
```
