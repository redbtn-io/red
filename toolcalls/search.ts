export async function search(args: {query: string}) {
    const query = args.query;
    const url = `https://www.googleapis.com/customsearch/v1?key=AIzaSyCo_wwVa8zN-1evnUtIzS5TD_7PfT9zN3k&cx=a2a467f1be3834cb3&q=${query}`;

    return new Promise((resolve) => {
      fetch(url)
        .then(async (res) => {
            const data: any = await res.json();
            const results: Result[] = [];
            data.items.forEach((item: Result) => {
                results.push({
                    title: item.title,
                    snippet: item.snippet,
                    link: item.link
                });
              });
            resolve(results);
      });
    });
}

interface Result {
    title: string;
    snippet: string;
    link: string;
}