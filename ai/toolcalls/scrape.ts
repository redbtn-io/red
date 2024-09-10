import puppeteer from 'puppeteer';

export async function scrape({url, keywords} : {url: string, keywords?: string[]}) {
    const data = await scrapePage(url);
    if (keywords) console.log(keywords);
    return data;
  
    async function scrapePage(url: string) {
      let retries = 3;
      while (retries > 0) {
        try {
          const text = await puppetScrape(url);
          const bodyStartIndex = text.indexOf("<body");
          const bodyEndIndex = text.indexOf("</body>");
          console.log(bodyStartIndex, bodyEndIndex);
          if (bodyStartIndex !== -1 && bodyEndIndex !== -1) {
            const bodyContent = text.substring(bodyStartIndex, bodyEndIndex + 7);
            const elements = getElements(bodyContent, ['div'],['disclaimer']);
            const filteredElements = filterElementsShort(elements).join(' ') + 
                filterElementsPartial(elements,
                     removeStopwords(keywords?.join(' ') || ''
                ).split(' ')) ;
            if (keywords) return filteredElements
            return elements;
          } else {
            throw new Error("body tag not found, find other sources");
          }
        } catch (error) {
          console.error(error);
          retries--;
        }
      }
      return "retry error";
    }
  }

// A function which accepts a string that is an HTML document, an array of element tags, & an array of classes to exclude. It returns an array of the contents of all elements of the specified tags, except those with the specified classes. Also, removes ALL tags, along with their attributes, from the content.
export function getElements(html: string, tags: string[], classes: string[] = []) {
    const elements: string[] = [];
    const re = new RegExp(`<(${tags.join("|")})[^>]*>(.*?)</\\1>`, "gs");
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        let element = match[2];
        if (!classes.some(className => element.includes(`class="${className}"`))) {
        elements.push(element.replace(/<[^>]*>/g, ""));
        }
    }
    return elements;
}

// A function which filters out elements based on keywords
export function filterElements(elements: string[], keywords: string[]) {
    return elements.filter(element => keywords.some(keyword => element.includes(keyword)));
}

// A function which filters out elements unless the contain all keywords
export function filterElementsStrict(elements: string[], keywords: string[]) {
    return elements.filter(element => keywords.every(keyword => element.includes(keyword)));
}

// A function which filters out elements unless the contain at least half of all keywords
export function filterElementsPartial(elements: string[], keywords: string[]) {
    return elements.filter(element => {
        const matches = keywords.filter(keyword => element.includes(keyword));
        return matches.length >= keywords.length / 2;
    });
}

// A function which filters out elements unless they are less than 12 words, OR contain a $, OR contain a number
export function filterElementsShort(elements: string[]) {
    return elements.filter(element => {
        const words = element.split(" ");
        return words.length < 12 || words.some(word => word.includes("$") || !isNaN(Number(word)));
    });
}

  // A function which removes common stopwords from a string
export function removeStopwords(text: string) {
    const stopwords = new Set([
      "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
      "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she",
      "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
      "theirs", "themselves", "what", "which", "who", "whom", "this", "that",
      "these", "those", "am", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an",
      "the", "and", "but", "if", "or", "because", "as", "until", "while", "of",
      "at", "by", "for", "with", "about", "against", "between", "into", "through",
      "during", "before", "after", "above", "below", "to", "from", "up", "down",
      "in", "out", "on", "off", "over", "under", "again", "further", "then", "once"
    ]);
    return text.split(" ").filter(word => !stopwords.has(word)).join(" ");
  }

  // A function which uses puppeteer to scrape a webpage
export async function puppetScrape(url: string) {
    const browser = await puppeteer.launch({headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"});
    const page = await browser.newPage();
    await page.goto(url);
    const content = await page.content();
    await browser.close();
    return content;
  }