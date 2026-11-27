# Generate the voiceover lines with an African English neural voice (Microsoft Edge TTS): RATE=-10% python3 scripts/tts.py
import asyncio, csv, os, ssl, sys
import edge_tts, edge_tts.communicate as comm
comm._SSL_CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
PROXY = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
VOICE = os.environ.get('VOICE', 'en-NG-AbeoNeural')
RATE = os.environ.get('RATE', '+0%')
rows = list(csv.DictReader(open('out/voiceover/lines.csv')))
only = set(sys.argv[1:])
async def main():
    for row in rows:
        if only and row['number'] not in only: continue
        await edge_tts.Communicate(row['tts_text'], VOICE, rate=RATE, proxy=PROXY).save(f"voice/{row['number']}.mp3")
        print(row['number'], end=' ', flush=True)
asyncio.run(main())
