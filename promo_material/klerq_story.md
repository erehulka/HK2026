## Inspiration
_I went to buy groceries for my flatmates, and all I got was this lousy receipt. Half of the stuff is just for me, and I shouldn't charge my vegan friend for the ground beef. If only there was an easy way to deal with this..._

## What it does
Use your phone camera to scan a physical receipt or paste in a digital one. Based on who is chiming in on what, expenses will be calculated for everyone in your group fairly.

### Features
- Scan a receipt in any language (or script)
- Translate into your preferred language with a single click
- Item labels are automatically rewritten to be understandable
- Set your preferences to automatically filter out items from your expenses
- Input expenses manually or by parsing an invoice... integrated accounting!
- You can add a shared card
- If your friends add their TB accounts, you can send them invoices with a single click

## How we built it
A python-based architecture underlying FastAPI, which is connected to MongoDB. A backend call processes the receipts using OCR, natural language interpretation, data extraction, and machine translation, by submitting a query to Mistral AI. The prototype uses limited free-tier tokens, but can be scaled up easily. The mobile app runs in React Native.

## Challenges we ran into
- We had to iterate on the core selling point to arrive at true innovation
- OCR and especially smart data extraction from natural language (full of abbreviations and brand names) is finnicky! It took us some time to arrive at something stable and reliable.
- The full stack is quite tall: from backend processing, through database access, to a sleek mobile UI. We had to aggressively delegate tasks among our team members.

## Accomplishments that we're proud of
Simply the powerful feeling you get from pointing your phone at a crumpled piece of paper and seeing organised lists, prices and quantities of items. We feel great about building something we actually want to use ourselves.

## What we learned
That building a mobile app is not so daunting after all! Also, a whole lot about language processing and the pitfalls of OCR. And me, personally, I learnt about how tricky it is to parse Arabic and other right-to-left running scripts!

## What's next for Klerq
Integration with Tatra Banka, of course! And a small survey to see what other features we can integrate seamlessly.

