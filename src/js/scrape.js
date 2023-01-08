const fs = require("fs").promises;
const axios = require("axios");
const cheerio = require("cheerio");

/**
 *
 * @param {string} url - The url of the site to search for emails, phones and contact forms
 * @returns {object} Containing all the data found
 */
const scrape = async (url) => {
  const { data } = await axios.get(url).catch((err) => {});

  const emailReg = new RegExp("[a-z0-9-]+@[a-z0-9-]+.[a-z.]+", "g");
  const phoneReg = new RegExp("([+]?d{1,2}[-s]?|)[9|6|7][0-9]{8}", "g");

  // Avoid strange extensions, like image extensions
  const avoidExtensions = ["png", "jpg", "gif"];
  const avoidExtensionsString = avoidExtensions
    .map((el) => `(${el})`)
    .join("|");
  const avoidExtensionsRegex = new RegExp(`(${avoidExtensionsString})`, "");

  let emails = data
    .match(emailReg)
    .filter((email) => !email.match(/\s/g))
    .filter((email) => !email.match(avoidExtensionsRegex));
  //let phones = data.match(phoneReg);

  return { emails: emails };
};

const inspect = async (url) => {
  const contactWord = "contact";
  const request = await axios.get(url).catch((err) => {});
  const page = request.data;
  const $ = cheerio.load(page);

  let links = [];
  $("a").each((_, el) => {
    let link = $(el).attr("href");
    if (!link.length || !link.match(/^http/)) return;
    if (!$(el).html().toLowerCase().includes(contactWord)) return;
    links.push(link);
  });

  return links;
};

/**
 * @param {string} url - The url of the site to execute a fuzz process (to detect any "Contact" page)
 * @returns {string} The exact url of that/those "Contact" pages
 */

const fuzz = async (url, searchFor = undefined) => {
  const contactSectionExtensions = [
    "contact",
    "contacto",
    "contacte",
    "Contact",
    "Contacto",
    "Contacte",
  ];

  let contactPath = undefined;
  for (let path of contactSectionExtensions) {
    const fuzUrl = `${url}/${path}`;
    const request = await axios.get(fuzUrl).catch((err) => {});
    if (!request) continue;
    const res = request.status === 200 ? fuzUrl : false;
    contactPath = res;
    break;
  }

  if (!contactPath) return undefined;

  const res = await scrape(contactPath).catch((err) => {});

  return res[searchFor] ?? res;
};

/**
 * Filters the emails list to avoid example emails, as name@yourdomain.com
 * @param {array} emails - Emails list
 * @returns Only the emails that aren't examples.
 */
const validateEmails = (emails) => {
  const namesToAvoid = ["name", "youremail"]; // All the names (before the @)
  const domainsToAvoid = ["example", "domain", "yourdomain"]; // All the domains (after the @)
  // We don't include the extensions because it'll would translate into more computacional power.
  // So, better if we remove the extension of the email we're examinating.

  let emailsToAvoid = [];

  // Generating all the possible combinations
  for (let name of namesToAvoid) {
    for (let domain of domainsToAvoid) {
      const email = `${name}@${domain}.`;
      emailsToAvoid.push(email);
    }
  }

  const res = emails.filter((email) => {
    const removedExt = email.match(/[a-z0-9-]+@[a-z0-9-]+./)[0]; // Removing the domain extension of the email that we're examinating
    if (!removedExt) return false;
    return !emailsToAvoid.includes(removedExt);
  });

  return res;
};

const extractData = async (url) => {
  let contactData = await scrape(url).catch((err) => {});
  //*TODO let phones = data.match(phoneReg);

  let emails = contactData.emails;
  //let phones = contactData.phones;

  if (!emails) emails = await fuzz(url, "emails").catch((err) => {});
  if (!emails) {
    const links = await inspect(url);
    emails = [];
    links.forEach(async (url) => {
      emails.push(await scrape(url).catch((err) => {}));
    });
  }
  //if (!phones) phones = await fuzz(url, "phones").catch((err) => {});

  // Filter duplicates
  emails = emails.filter((item, index) => {
    return emails.indexOf(item) === index;
  });

  emails = validateEmails(emails);

  const res = {
    url: url,
    emails: emails ?? [],
  };

  return res;
};

/**
 * Gets all the contact data from evary possible customer found in the scrape results
 *
 * @param {string} query - The query to search on Google for
 */
const getPossibleCustomers = async (query) => {
  const parsedQuery = encodeURIComponent(query);
  const url = `https://www.google.com/search?gl=es&tbm=map&q=${parsedQuery}&pb=!4m8!1m3!1d9806446.994310042!2d-2.7874037!3d39.2368123!3m2!1i496!2i1190!4f13.1!7i20!10b1!12m13!1m1!18b1!17m2!1e1!1e0!20m5!1e0!2e3!3b0!5e2!6b1!26b1!27b1!19m4!2m3!1i320!2i120!4i8!20m32!3m1!2i9!6m3!1m2!1i360!2i256!7m24!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2!9b0!22m6!7e140!9s2I8nY4b6OeiB9u8P1oir8AI!15i26171!17s2I8nY4b6OeiB9u8P1oir8AI%3A566220029973!24m1!2e1!24m16!1m3!18m2!14b0!17b1!2b1!4b1!5m2!5b1!6b1!17b1!20m2!1e3!1e1!24b1!29b1!89b1!26m7!1e12!1e15!1e13!1e3!2m2!1i80!2i80!34m5!9b1!12b1!14b1!25b1!26b1!37m1!1e140!49m0!69i618`;
  const { data } = await axios.get(url).catch((err) => {});
  // Stringify the data to get URL matches from there (via regex)
  const strData = JSON.stringify(data);
  const urlReg = new RegExp("https?://[^#?/]+", "g");
  const res = strData
    .match(urlReg)
    // Filter the results to avoid Google-internal links (we make sure that sites made with Google Sites appear)
    .filter((el) => el.match("sites.google") || !el.match("google"));

  console.log(res);
  let filteredRes = res
    .filter((item, index) => res.indexOf(item) === index)
    .map((el) => {
      if (el[el.length - 1] !== "/") return el;
      el.length--;
      return el;
    });

  let customersData = [];
  for (let customer of filteredRes) {
    const customerData = await extractData(customer).catch((err) => {});
    if (!customerData) continue;
    customersData.push(customerData);
  }

  return customersData;
};

module.exports.getPossibleCustomers = getPossibleCustomers;
