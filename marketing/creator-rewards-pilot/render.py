"""Render the local Creator Rewards pilot film. No network or provider calls.

Requires Pillow, numpy, ffmpeg, and macOS `say` (Samantha).
Usage: VIDEO_FFMPEG=/path/to/ffmpeg python3 render.py
"""
from pathlib import Path
import json, math, os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
WORK = OUT / 'render-assets'
WORK.mkdir(exist_ok=True)
FFMPEG = os.environ.get('VIDEO_FFMPEG', 'ffmpeg')
W, H, FPS, SR = 1920, 1080, 30, 48000
CLOUD = '#edf3f5'
INK = '#193b47'
SEA = '#22776d'
ORANGE = '#f36c32'
MUTED = '#647d85'
FONT_DIR = Path('/System/Library/Fonts/Supplemental')
FONTS = {}

SCENES = [
    {'id':'hook', 'voice':'A creator brings a customer to your store. What if the reward felt as personal as the recommendation?'},
    {'id':'idea', 'voice':'Meet Creator Rewards. Connect your creator partnerships with personalized product rewards, funded by a budget you control.'},
    {'id':'personal', 'voice':'A fan chooses a creator design, then adds a personal detail. Arcade generates a personalized product preview. Their story, with their own finishing touch.'},
    {'id':'shopify', 'voice':'Bring the collection into the shopping experience. Our Shopify prototype shows how a customer can discover a reward while browsing your store.'},
    {'id':'economics', 'voice':'You set the economics: creator commission, the reward budget, and your contribution target. Explore the model before committing to a pilot.'},
    {'id':'pilot', 'voice':'Start with one store and one creator. Then measure contribution per referred visitor against your current affiliate offer.'},
    {'id':'cta', 'voice':'Make your next creator partnership more personal. Creator Rewards. Let\'s talk about a pilot.'},
]

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)

def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype(str(FONT_DIR / ('Arial Bold.ttf' if bold else 'Arial.ttf')), size)
    return FONTS[key]

def text(im, xy, s, size=32, color=INK, bold=False, spacing=10):
    ImageDraw.Draw(im).multiline_text(xy, s, fill=color, font=font(size, bold), spacing=spacing)

def rr(im, box, fill, radius=28, outline=None, width=2):
    ImageDraw.Draw(im).rounded_rectangle(tuple(map(int,box)), radius, fill, outline, width)

def ease(x):
    x=max(0,min(1,x)); return 1-(1-x)**3

def picture(im, source, box, zoom=1.0, radius=28):
    x,y,w,h = map(int,box)
    ratio=max(w/source.width,h/source.height)*zoom
    resized=source.resize((int(source.width*ratio),int(source.height*ratio)),Image.Resampling.LANCZOS)
    left=(resized.width-w)//2; top=(resized.height-h)//2
    crop=resized.crop((left,top,left+w,top+h))
    mask=Image.new('L',(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius,fill=255)
    im.paste(crop,(x,y),mask)

PRODUCT=Image.open(ROOT/'docs/qa/arcade-customer-product-full.png').convert('RGB')
# Remove only the browser's black side bars. Preserve the generated product.
PRODUCT=PRODUCT.crop((732,0,2292,1560))
SHOP=Image.open(ROOT/'docs/qa/shopify-final-image-and-thumbnail.png').convert('RGB')

def logo(im,dark=False):
    color=CLOUD if dark else INK
    text(im,(88,49),'creator rewards',38,color,True)
    ImageDraw.Draw(im).ellipse((388,62,407,81),fill=ORANGE)
    text(im,(1480,59),'A MORE PERSONAL REWARD',20,color)

def eyebrow(im,s,dark=False,y=192):
    text(im,(90,y),s,24,'#8ac4ba' if dark else SEA,True)

def card(im,box,label,value,sub,color=INK):
    rr(im,box,'#ffffff',32)
    x,y,x2,y2=box
    text(im,(x+35,y+35),label,29,MUTED)
    text(im,(x+35,y+105),value,102,color,True)
    text(im,(x+35,y2-75),sub,27,MUTED)

def compose(idx,local,caption='',time=0,total=1):
    dark=idx in (0,5)
    im=Image.new('RGB',(W,H),INK if dark else CLOUD)
    d=ImageDraw.Draw(im)
    p=ease(local/0.85); dy=int((1-p)*36)
    dur=SCENES[idx]['duration']; drift=min(local/dur,1)
    logo(im,dark)
    if idx==0:
        eyebrow(im,'FOR STORES WORKING WITH CREATORS',True,220+dy)
        text(im,(86,302+dy),'Make the reward\nworth remembering.',91,CLOUD,True,14)
        text(im,(90,567+dy),'A creator’s story.\nA customer’s personal touch.',37,'#b8d4d8',False,14)
        d.ellipse((1110,140,1800,830),fill=ORANGE)
        picture(im,PRODUCT,(1040,182-int(12*drift),760,660),1.03+drift*.045,44)
        rr(im,(1168,784,1718,860),'#ffffff',24)
        text(im,(1200,803),'Made personal: Yosemite 2026',28,INK,True)
    elif idx==1:
        eyebrow(im,'MEET CREATOR REWARDS',False,174+dy)
        text(im,(88,230+dy),'One partnership. A personal reward.',76,INK,True)
        for j,(n,title,sub) in enumerate([
            ('01','Creator','A collection with a story'),
            ('02','Customer','Their own finishing touch'),
            ('03','Your store','A reward budget you set')]):
            x=90+j*595; y=390+int((1-ease((local-j*.18)/.75))*35)
            rr(im,(x,y,x+550,y+350),'#ffffff',30)
            text(im,(x+32,y+30),n,28,SEA,True)
            text(im,(x+32,y+97),title,55,INK,True)
            text(im,(x+32,y+194),sub,29,MUTED)
            d.rectangle((x+32,y+295,x+170+int(300*ease((local-.4-j*.2)/1)),y+301),fill=ORANGE if j==2 else SEA)
        text(im,(91,802),'Creator collection  +  customer personalization  +  merchant-funded benefit',30,SEA)
    elif idx==2:
        eyebrow(im,'ARCADE PERSONALIZATION',False,215+dy)
        text(im,(86,286+dy),'Their story.\nTheir personal\ntouch.',91,INK,True,7)
        rr(im,(90,670,834,777),'#ffffff',20)
        typed='Yosemite 2026'[:max(0,min(13,int((local-.6)*10)))]
        text(im,(118,698),typed+('|' if local<2.2 else ''),39,SEA)
        text(im,(92,807),'Saved Arcade-generated product preview',26,MUTED)
        picture(im,PRODUCT,(997,167,825,690),1.02+drift*.075,34)
    elif idx==3:
        eyebrow(im,'IN THE SHOPPING EXPERIENCE',False,219+dy)
        text(im,(87,292+dy),'From creator\ncollection\nto your store.',91,INK,True,10)
        text(im,(91,637+dy),'Discover a design.\nMake the reward feel personal.',35,MUTED,False,16)
        # Existing captured development-store UI, not an invented live flow.
        rr(im,(1120,137,1819,884),'#d7e3e7',38)
        picture(im,SHOP,(1131,148,677,724),1.0,30)
        text(im,(91,825),'Recorded Shopify development-store demo',25,SEA)
    elif idx==4:
        eyebrow(im,'A BUDGET YOU CONTROL',False,174+dy)
        text(im,(88,230+dy),'You set the economics.',86,INK,True)
        card(im,(90,391,615,726),'Store contribution','$80','Illustrative reward budget',SEA)
        card(im,(697,391,1222,726),'Customer co-pay','$60','Remaining reward cost',INK)
        card(im,(1304,391,1829,726),'Reward cost model','$140','Merchant-configured assumption',INK)
        text(im,(637,502),'+',52,SEA)
        text(im,(1246,502),'=',52,SEA)
        rr(im,(90,775,1829,795),'#d6e2e6',10)
        rr(im,(90,775,90+int(1739*min(1,local/2)*80/140),795),SEA,10)
        if local>1:
            x=90+int(1739*80/140)
            rr(im,(x,775,x+max(1,int(1739*min(1,(local-1)/2)*60/140)),795),ORANGE,10)
        text(im,(91,828),'Illustrative model. Total reward cost requires validation of production, shipping and tax.',24,MUTED)
    elif idx==5:
        eyebrow(im,'THE NEXT STEP: A FOCUSED PILOT',True,177+dy)
        text(im,(87,248+dy),'Start small.\nMeasure what matters.',91,CLOUD,True,14)
        for j,(a,b) in enumerate([('01','Store'),('01','Creator')]):
            x=90+j*475
            rr(im,(x,556,x+425,812),'#254b57',28)
            text(im,(x+32,578),a,98,CLOUD,True)
            text(im,(x+35,723),b,34,'#b8d4d8')
        rr(im,(1055,556,1829,812),SEA,28)
        text(im,(1091,588),'MEASURE',24,'#c8e9e2',True)
        text(im,(1091,635),'Contribution per\nreferred visitor',47,'#ffffff',True,10)
        text(im,(91,840),'Compare with your current affiliate offer.',28,'#b8d4d8')
    else:
        eyebrow(im,'CREATOR REWARDS',False,198+dy)
        text(im,(86,269+dy),'Make your next\ncreator partnership\nmore personal.',87,INK,True,9)
        rr(im,(90,637,909,749),ORANGE,23)
        text(im,(124,670),'Let’s talk about a pilot',44,'#ffffff',True)
        d.line((825,695,872,695),fill='white',width=4)
        d.line((859,683,872,695,859,707),fill='white',width=4)
        text(im,(92,797),'One store. One creator. A shared experiment.',28,MUTED)
        picture(im,PRODUCT,(1100,211,704,594),1.08-drift*.045,36)
    if caption:
        f=font(32)
        bbox=d.textbbox((0,0),caption,font=f)
        cw=bbox[2]-bbox[0]
        rr(im,((W-cw)//2-25,934,(W+cw)//2+25,994),'#102b35',14)
        text(im,((W-cw)//2,945),caption,32,'#ffffff')
    d.line((90,1033,1830,1033),fill='#42616a' if dark else '#d2dfe3',width=3)
    d.line((90,1033,90+int(1740*time/total),1033),fill=ORANGE,width=5)
    text(im,(90,1051),'CREATOR REWARDS  /  PILOT FILM',13,'#97b4bc' if dark else MUTED)
    text(im,(1450,1051),'PROTOTYPE  ·  NO LIVE CHECKOUT',13,'#97b4bc' if dark else MUTED)
    return im

def srt_time(t):
    ms=round(t*1000); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'

def main():
    print('Preparing English voiceover…',flush=True)
    cursor=0; audio_parts=[]; captions=[]
    for i,s in enumerate(SCENES):
        f=WORK/f'voice-{i:02}.txt'; f.write_text(s['voice'])
        aiff=WORK/f'voice-{i:02}.aiff'; wav=WORK/f'voice-{i:02}.wav'
        if not aiff.exists():
            run(['say','-v','Samantha','-r','163','-f',str(f),'-o',str(aiff)])
        run([FFMPEG,'-v','error','-y','-i',str(aiff),'-ar',str(SR),'-ac','1',str(wav)])
        with wave.open(str(wav)) as r:
            voice=np.frombuffer(r.readframes(r.getnframes()),dtype='<i2').astype(np.float64)/32768
        if len(voice)<SR:
            raise RuntimeError(f'Voice clip {i} is empty or too short. Regenerate the AIFF with access to the macOS speech service.')
        rms=np.sqrt(np.mean(voice**2))
        voice*=min(2,.115/max(rms,.001))
        before=.45; after=.65 if i<6 else 1.8
        nframes=math.ceil((len(voice)/SR+before+after)*FPS)
        s.update(start=cursor,duration=nframes/FPS,voice_duration=len(voice)/SR)
        chunk=np.zeros(round(nframes/FPS*SR))
        offset=round(before*SR); chunk[offset:offset+len(voice)]=voice
        audio_parts.append(chunk)
        words=s['voice'].split(); groups=[]; current=[]
        for word in words:
            current.append(word)
            if len(' '.join(current))>48 or word.endswith(('.', '?', ':')):
                groups.append(' '.join(current));current=[]
        if current: groups.append(' '.join(current))
        # Keep a short sentence ending with its preceding phrase.
        joined=[]
        for group in groups:
            if len(group.split())<=2 and joined:
                joined[-1]+=' '+group
            else:
                joined.append(group)
        groups=joined
        count=0
        for group in groups:
            n=len(group.split())
            captions.append({'start':cursor+before+count/len(words)*len(voice)/SR,'end':cursor+before+(count+n)/len(words)*len(voice)/SR,'text':group,'scene':i})
            count+=n
        cursor+=nframes/FPS
        print(f'Scene {i+1}: {s["duration"]:.2f}s',flush=True)
    total=cursor
    narration=np.concatenate(audio_parts)
    # Original synthesized ambient bed; no third-party recording or music sample.
    n=len(narration); t=np.arange(n)/SR; music=np.zeros(n)
    chords=[(146.83,220,293.66,349.23),(130.81,196,261.63,329.63),(174.61,220,261.63,349.23),(164.81,246.94,293.66,392)]
    for start in np.arange(0,total,8):
        duration=min(9.4,total-start)
        a=round(start*SR); b=min(n,a+round(duration*SR)); tt=np.arange(b-a)/SR
        env=np.minimum(1,tt/1.4)*np.minimum(1,(duration-tt)/1.8)
        chord=chords[int(start//8)%len(chords)]
        for k,f in enumerate(chord):
            music[a:b]+=0.0035*env*np.sin(2*np.pi*f*tt+k*.3)*(1+.15*np.sin(tt*.8))
    for beat in np.arange(1,total-1,.75):
        a=round(beat*SR); b=min(n,a+round(.42*SR)); tt=np.arange(b-a)/SR
        f=[587.33,659.25,880,698.46][int(beat/.75)%4]
        music[a:b]+=.006*np.sin(2*np.pi*f*tt)*np.exp(-tt*14)*np.minimum(tt/.006,1)
    music*=np.minimum(1,t/2)*np.minimum(1,(total-t)/2)
    mix=np.clip(narration+music,-.98,.98)
    for name,arr in [('soundtrack.wav',mix),('voiceover.wav',narration)]:
        with wave.open(str(OUT/name),'wb') as r:
            r.setnchannels(1);r.setsampwidth(2);r.setframerate(SR);r.writeframes((arr*32767).astype('<i2').tobytes())
    (OUT/'captions.en.srt').write_text('\n\n'.join(f'{i+1}\n{srt_time(c["start"])} --> {srt_time(c["end"])}\n{c["text"]}' for i,c in enumerate(captions))+'\n')
    (OUT/'storyboard.json').write_text(json.dumps({'title':'Creator Rewards — A More Personal Reward','audience':'E-commerce owners considering a pilot','language':'en-US','width':W,'height':H,'fps':FPS,'duration':total,'voice':'macOS Samantha (synthetic)','music':'Original synthesized ambient bed','scenes':SCENES,'source_assets':['docs/qa/arcade-customer-product-full.png','docs/qa/shopify-final-image-and-thumbnail.png'],'claims_source':['docs/pitch-90s.md','docs/demo-finish-line.md'],'status':'Marketing draft; no measured uplift or production readiness claimed'},indent=2))
    (OUT/'voiceover.en.txt').write_text('\n\n'.join(s['voice'] for s in SCENES)+'\n')
    print(f'Rendering {total:.2f}s at {W}×{H}, {FPS}fps…',flush=True)
    video=OUT/'creator-rewards-pilot-en.mp4'
    cmd=[FFMPEG,'-v','warning','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(OUT/'soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(video)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    thumbs=[]; frame_num=0; cap_i=0
    for idx,s in enumerate(SCENES):
        count=round(s['duration']*FPS)
        for fi in range(count):
            local=fi/FPS; absolute=s['start']+local
            while cap_i<len(captions) and captions[cap_i]['end']<absolute: cap_i+=1
            caption=''
            if cap_i<len(captions) and captions[cap_i]['start']<=absolute<=captions[cap_i]['end']:
                caption=captions[cap_i]['text']
            im=compose(idx,local,caption,absolute,total)
            # Brief editorial dissolve between adjacent scenes.
            if idx>0 and fi<10:
                previous=compose(idx-1,SCENES[idx-1]['duration'],'',absolute,total)
                im=Image.blend(previous,im,ease(fi/10))
            if fi==round(count*.55):
                im.save(WORK/f'scene-{idx+1:02}.jpg',quality=93)
                thumbs.append(im.resize((640,360),Image.Resampling.LANCZOS))
            if idx==0 and fi==int(FPS*3):
                im.save(OUT/'poster.jpg',quality=95)
            proc.stdin.write(im.tobytes());frame_num+=1
        print(f'Rendered scene {idx+1}/{len(SCENES)}',flush=True)
    proc.stdin.close()
    if proc.wait()!=0: raise RuntimeError('Video encode failed')
    sheet=Image.new('RGB',(1280,4*360),CLOUD)
    for i,im in enumerate(thumbs): sheet.paste(im,((i%2)*640,(i//2)*360))
    sheet.save(OUT/'storyboard-preview.jpg',quality=92)
    print(f'Done: {video} ({frame_num} frames)',flush=True)

if __name__=='__main__': main()
