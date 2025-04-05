## Inspiration
Misinformation and fake news run rampant online with no quick way to check if the information is factual. This inspired us to create Factify as a tool to empower users to get instant fact-checking and bias analysis.

## What it does
Factify is a Google Chrome Extension that will evaluate a highlighted statement or webpage for factual accuracy and bias by using Perplexity's Sonar-Reasoning-Pro API. It returns a score from 0-100 for both factualness and bias, along with listing the reasoning and sources that it used to do this. An additional feature of our extension is the community feature where users can either like or dislike fact checks that are saved to the community page by other users.

## How we built it
We built the extension using HTML, CSS, and JavaScript to read any text chosen by a user and run this text through Perplexity Sonar reasoning model to create a detailed overview with citations in a interactive side panel.

## Challenges we ran into
We struggled when figuring out how to implement the dynamic side panel that opens on a button click. Also, designing the UI so it would display all of our data in an easily understandable format.

## Accomplishments that we're proud of
We are proud of making a Google Chrome Extension for the first time, including a dynamic side panel and button click feature upon user highlighting text. This was also a majority of the team's first time using an artificial intelligence API. The community feature is also something we are proud of as it allows us to further differentiate our product from other similar products.

## What we learned
We gained experience in creating a Google Chrome Extension with an easily understandable and space friendly design. Additionally, three of us also have never worked with an AI API before, which allowed us to learn about cutting-edge technology

## What's next for Factify
Our next steps include publishing our extension to the Google Chrome Webstore. Also, giving rag model context to true sources to allow students or academic writers to use truthful information in their writing. We would also like to continue to explore the community feature.
