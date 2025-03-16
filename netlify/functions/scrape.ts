import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Helper function to convert image URL to base64
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = response.headers.get('content-type');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return null;
  }
}

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    const url = event.queryStringParameters?.url;
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract common meta tags and OpenGraph data
    const title = $('meta[property="og:title"]').attr('content') || 
                 $('title').text() || 
                 $('meta[name="title"]').attr('content');

    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content');

    const imageUrl = $('meta[property="og:image"]').attr('content') || 
                    $('meta[property="product:image"]').attr('content');

    // Try to determine the category
    let category = $('meta[property="product:category"]').attr('content');
    if (!category) {
      // Look for breadcrumbs or category links
      const breadcrumbs = $('.breadcrumb, .breadcrumbs').find('a').last().text();
      const categoryLinks = $('a[href*="category"], a[href*="department"]').first().text();
      category = breadcrumbs || categoryLinks || undefined;
    }

    // Clean up the data
    const cleanText = (text?: string) => {
      return text ? text.trim().replace(/\s+/g, ' ') : undefined;
    };

    // Convert image to base64 if available
    let base64Image = null;
    if (imageUrl) {
      base64Image = await imageUrlToBase64(imageUrl);
    }

    const scrapedData = {
      title: cleanText(title),
      description: cleanText(description),
      category: cleanText(category),
      imageUrl: base64Image || imageUrl,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(scrapedData)
    };
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to scrape the URL' })
    };
  }
}