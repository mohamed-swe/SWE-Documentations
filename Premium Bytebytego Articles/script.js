// Article data - will be populated dynamically
let articles = [];

// DOM elements
const articlesGrid = document.getElementById("articlesGrid");
const searchInput = document.getElementById("searchInput");
const totalArticlesElement = document.getElementById("totalArticles");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  loadArticles();
  setupSearch();
  setupCategoryFilter();
  setupSortFilter();
  loadWatchedArticles();
});

// Function to extract date from HTML file
async function getFileDate(filename) {
  try {
    // Try to fetch the HTML file to extract date information
    const response = await fetch(filename);
    const htmlContent = await response.text();

    // Parse the HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // Look for various date indicators in the HTML
    let dateFound = null;

    // Check for meta tags with date information
    const metaDate = doc.querySelector(
      'meta[name="date"], meta[name="created"], meta[name="published"], meta[property="article:published_time"], meta[property="article:published"], meta[name="article:published_time"]'
    );
    if (metaDate) {
      dateFound = new Date(metaDate.getAttribute("content"));
    }

    // Check for time elements
    if (!dateFound) {
      const timeElement = doc.querySelector("time[datetime]");
      if (timeElement) {
        dateFound = new Date(timeElement.getAttribute("datetime"));
      }
    }

    // Check for JSON-LD structured data
    if (!dateFound) {
      const jsonLdScripts = doc.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const script of jsonLdScripts) {
        try {
          const jsonData = JSON.parse(script.textContent);
          if (
            jsonData.datePublished ||
            jsonData.dateCreated ||
            jsonData.dateModified
          ) {
            dateFound = new Date(
              jsonData.datePublished ||
                jsonData.dateCreated ||
                jsonData.dateModified
            );
            break;
          }
        } catch (e) {
          // Continue to next script
        }
      }
    }

    // Check for date in title or content with more comprehensive patterns
    if (!dateFound) {
      const titleElement = doc.querySelector("title");
      if (titleElement) {
        const titleText = titleElement.textContent;
        // Look for date patterns in title (YYYY-MM-DD, MM/DD/YYYY, etc.)
        const datePatterns = [
          /(\d{4}-\d{2}-\d{2})/,
          /(\d{2}\/\d{2}\/\d{4})/,
          /(\d{1,2}\/\d{1,2}\/\d{4})/,
          /(\d{4}\/\d{2}\/\d{2})/,
          /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
          /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
        ];

        for (const pattern of datePatterns) {
          const match = titleText.match(pattern);
          if (match) {
            dateFound = new Date(match[0]);
            break;
          }
        }
      }
    }

    // Check for date in body content with more comprehensive patterns
    if (!dateFound) {
      const bodyText = doc.body ? doc.body.textContent : "";
      const datePatterns = [
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{2}\/\d{2}\/\d{4})/,
        /(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
        // Additional patterns for common date formats
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
        /(\d{4}-\d{1,2}-\d{1,2})/,
        /(\d{1,2}-\d{1,2}-\d{4})/,
      ];

      for (const pattern of datePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          dateFound = new Date(match[0]);
          break;
        }
      }
    }

    // Check for date in the raw HTML content (for minified content)
    if (!dateFound) {
      const datePatterns = [
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{2}\/\d{2}\/\d{4})/,
        /(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
        /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
        /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
      ];

      for (const pattern of datePatterns) {
        const match = htmlContent.match(pattern);
        if (match) {
          dateFound = new Date(match[0]);
          console.log(
            `Found date in ${filename}: ${
              match[0]
            } -> ${dateFound.toISOString()}`
          );
          break;
        }
      }
    }

    // If no date found, use file modification time (if available) or current date
    if (!dateFound || isNaN(dateFound.getTime())) {
      // Try to get file modification time from response headers
      const lastModified = response.headers.get("last-modified");
      if (lastModified) {
        dateFound = new Date(lastModified);
        console.log(
          `Using last-modified header for ${filename}: ${lastModified} -> ${dateFound.toISOString()}`
        );
      } else {
        // Fallback to current date
        dateFound = new Date();
        console.log(
          `Using current date as fallback for ${filename}: ${dateFound.toISOString()}`
        );
      }
    }

    return dateFound.toISOString();
  } catch (error) {
    console.warn(`Could not extract date from ${filename}:`, error);
    // Fallback to current date if file can't be read
    return new Date().toISOString();
  }
}

// Load articles dynamically using a predefined list approach
// Since we can't directly read directory contents with pure JS, we'll use a smart approach
async function loadArticles() {
  try {
    showLoading();

    // Predefined list of all files in the directory
    const fileList = [
      "15 Open-Source Projects That Changed the World.htm",
      "6 More Microservices Interview Questions.htm",
      "7 Microservices Interview Questions.htm",
      "A Brief History of Scaling Netflix.htm",
      "A Crash Course in API Versioning Strategies.htm",
      "A Crash Course in Caching - Final Part.htm",
      "A Crash Course in Caching - Part 1.htm",
      "A Crash Course in Caching - Part 2.htm",
      "A Crash Course in CICD.htm",
      "A Crash Course in Database Scaling Strategies.htm",
      "A Crash Course in Database Sharding.htm",
      "A Crash Course in DNS (Domain Name System).htm",
      "A Crash Course in Docker.htm",
      "A Crash Course in GraphQL.htm",
      "A Crash Course in IPv4 Addressing.htm",
      "A Crash Course in Kubernetes.htm",
      "A Crash Course in Networking.htm",
      "A Crash Course in Redis.htm",
      "A Crash Course on Architectural Scalability.htm",
      "A Crash Course on Cell-based Architecture.htm",
      "A Crash Course on Content-Delivery Networks (CDN).htm",
      "A Crash Course on Distributed Systems.htm",
      "A Crash Course on Domain-Driven Design.htm",
      "A Crash Course on Load Balancers for Scaling.htm",
      "A Crash Course on Microservice Communication Patterns.htm",
      "A Crash Course on Microservices Design Patterns.htm",
      "A Crash Course on Relational Database Design.htm",
      "A Crash Course on REST APIs.htm",
      "A Crash Course on Scaling the API Layer.htm",
      "A Crash Course on Scaling the Data Layer.htm",
      "A Deep Dive into HTTP - From HTTP 1 to HTTP 3.htm",
      "A Detailed Guide to Content Delivery Networks.htm",
      "A Guide to Database Replication - Key Concepts and Strategies.htm",
      "A Guide to Database Sharding - Key Strategies.htm",
      "A Guide to Database Transactions - From ACID to Concurrency Control.htm",
      "A Guide to Rate Limiting Strategies.htm",
      "A Guide to Top Caching Strategies.htm",
      "A Pattern Every Modern Developer Should Know - CQRS.htm",
      "API Gateway vs Service Mesh - Which One Do You Need.htm",
      "API Gateway.htm",
      "API Protocols 101 - A Guide to Choose the Right One.htm",
      "API redesign - shopping cart and Stripe payment.htm",
      "API Security Best Practices.htm",
      "CAP, PACELC, ACID, BASE - Essential Concepts for an Architect's Toolkit.htm",
      "Capacity Planning.htm",
      "Clean Architecture 101 - Building Software That Lasts.htm",
      "Common Failure Causes.htm",
      "Consistency and Partition Tolerance - Understanding CAP vs PACELC.htm",
      "Consistent Hashing 101 - How Modern Systems Handle Growth and Failure.htm",
      "Coupling and Cohesion - The Two Principles for Effective Architecture.htm",
      "Dark Side of Distributed Systems - Latency and Partition Tolerance.htm",
      "Data Replication - A Key Component for Building Large-Scale Distributed Systems.htm",
      "Data Sharing Between Microservices.htm",
      "Database Index Internals - Understanding the Data Structures.htm",
      "Database Indexing Demystified - Index Types and Use-Cases.htm",
      "Database Indexing Strategies - Part 2.htm",
      "Database Indexing Strategies.htm",
      "Database Performance Demystified - Essential Tips and Strategies.htm",
      "Database Schema Design Simplified - Normalization vs Denormalization.htm",
      "Design Effective and Secure REST APIs.htm",
      "Distributed Caching - The Secret to High-Performance Applications.htm",
      "Does Serverless Have Servers.htm",
      "Domain-Driven Design (DDD) Demystified.htm",
      "Embracing Chaos to Improve System Resilience - Chaos Engineering.htm",
      "Engineering Trade-offs - Eventual Consistency in Practice.htm",
      "EP68 - Top architectural styles.htm",
      "Event-Driven Architectural Patterns.htm",
      "Everything You Always Wanted to Know About TCP But Too Afraid to Ask.htm",
      "Factors to Consider in Database Selection.htm",
      "From 0 to Millions - A Guide to Scaling Your App - Final Part.htm",
      "From 0 to Millions - A Guide to Scaling Your App - Part 1.htm",
      "From 0 to Millions - A Guide to Scaling Your App - Part 2.htm",
      "From 0 to Millions - A Guide to Scaling Your App - Part 3.htm",
      "From Monolith to Microservices - Key Transition Patterns.htm",
      "Good Code vs. Bad Code.htm",
      "GraphQL 101 - API Approach Beyond REST.htm",
      "How do We Design for High Availability.htm",
      "How to Build a Smart Chatbot in 10 mins with LangChain.htm",
      "How to Choose a Message Queue - Kafka vs. RabbitMQ.htm",
      "How to Choose a Replication Strategy.htm",
      "How to Design a Good API.htm",
      "How Video Recommendations Work - Part 1.htm",
      "HTTP1 vs HTTP2 vs HTTP3 - A Deep Dive.htm",
      "I Was Under Leveled!  Avoiding the Tragedy of Making Only $500k a Year.htm",
      "Infrastructure as Code.htm",
      "Key Steps in the Database Selection Process.htm",
      "Kubernetes - When and How to Apply It.htm",
      "Kubernetes Made Easy - A Beginner's Roadmap to Container Orchestration.htm",
      "Mastering Data Consistency Across Microservices.htm",
      "Mastering Design Principles - SOLID.htm",
      "Mastering Idempotency - Building Reliable APIs.htm",
      "Mastering Modern Authentication - Cookies, Sessions, JWT, and PASETO.htm",
      "Mastering OOP Fundamentals with SOLID Principles.htm",
      "Mastering the Art of API Design.htm",
      "Messaging Patterns Explained - Pub-Sub, Queues, and Event Streams.htm",
      "Monolith vs Microservices vs Modular Monoliths - What's the Right Choice.htm",
      "Netflix - What Happens When You Press Play - Part 2.htm",
      "Netflix - What Happens When You Press Play.htm",
      "Network Protocols behind Server Push, Online Gaming, and Emails.htm",
      "Network Protocols Run the Internet.htm",
      "No More Vendor Lock-In - The Rise of Sky Computing.htm",
      "Non-Functional Requirements - The Backbone of Great Software - Part 1.htm",
      "Non-Functional Requirements - The Backbone of Great Software - Part 2.htm",
      "OOP Design Patterns and Anti-Patterns - What Works and What Fails.htm",
      "Password, Session, Cookie, Token, JWT, SSO, OAuth - Authentication Explained - Part 1.htm",
      "Password, Session, Cookie, Token, JWT, SSO, OAuth - Authentication Explained - Part 2.htm",
      "Rate Limiter For The Real World.htm",
      "Rate Limiting Fundamentals.htm",
      "Redis Can Do More Than Caching.htm",
      "Shipping to Production.htm",
      "Software Architecture Patterns.htm",
      "Speedrunning Guide - Junior to Staff Engineer in 3 years.htm",
      "SQL vs NoSQL - Choosing the Right Database for An Application.htm",
      "Stateless Architecture - The Key to Building Scalable and Resilient Systems.htm",
      "Synchronous vs Asynchronous Communication - When to Use What.htm",
      "The 6 Most Impactful Ways Redis is Used in Production Systems.htm",
      "The Art of REST API Design - Idempotency, Pagination, and Security.htm",
      "The Saga Pattern.htm",
      "The Sidecar Pattern Explained - Decoupling Operational Features.htm",
      "The Tech Promotion Algorithm - A Structured Guide to Moving Up.htm",
      "The Top 3 Resume Mistakes Costing You the Job.htm",
      "Tidying Code.htm",
      "Top Leader Election Algorithms in Distributed Databases.htm",
      "Top Scalability Strategies for Real-World Load.htm",
      "Top Strategies to Improve Reliability in Distributed Systems.htm",
      "Top Strategies to Reduce Latency.htm",
      "Understanding Database Types.htm",
      "Understanding Load Balancers - Traffic Management at Scale.htm",
      "Understanding Message Queues.htm",
      "Unlock Highly Relevant Search with AI.htm",
      "Unlocking the Power of SQL Queries for Improved Performance.htm",
      "Virtualization and Containerization - Which one to pick.htm",
      "What Happens When a SQL is Executed.htm",
      "Why Do We Need a Message Queue.htm",
      "Why Executives Seem Out of Touch, and How to Reach Them.htm",
      "Why is Kafka so fast - How does it work.htm",
      "Why the Internet Is Both Robust and Fragile.htm",
    ];

    // Process each file
    articles = await Promise.all(
      fileList.map(async (filename) => {
        const title = filename.replace(/\.(htm|html)$/i, "");
        const fileDate = await getFileDate(filename);

        return {
          title: title,
          filename: filename,
          category: categorizeArticle(title),
          description: generateDescription(title),
          icon: getIconForArticle(title),
          watched: false,
          dateAdded: fileDate,
        };
      })
    );

    // Sort articles alphabetically by title
    articles.sort((a, b) => a.title.localeCompare(b.title));

    // Add a small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Load watched status from localStorage
    loadWatchedStatus();

    renderArticles(articles);
    updateStats();
    populateCategoryFilter();
  } catch (error) {
    console.error("Error loading articles:", error);
    showError("Failed to load articles. Please refresh the page.");
  }
}

// Categorize articles based on title keywords
function categorizeArticle(title) {
  const titleLower = title.toLowerCase();

  if (
    titleLower.includes("api") ||
    titleLower.includes("rest") ||
    titleLower.includes("graphql") ||
    titleLower.includes("idempotency") ||
    titleLower.includes("authentication") ||
    titleLower.includes("rate limiting") ||
    titleLower.includes("protocols")
  ) {
    return "APIs";
  } else if (
    titleLower.includes("database") ||
    titleLower.includes("sql") ||
    titleLower.includes("sharding") ||
    titleLower.includes("performance") ||
    titleLower.includes("caching") ||
    titleLower.includes("indexing") ||
    titleLower.includes("replication") ||
    titleLower.includes("transactions") ||
    titleLower.includes("nosql") ||
    titleLower.includes("redis")
  ) {
    return "Database";
  } else if (
    titleLower.includes("microservice") ||
    titleLower.includes("distributed") ||
    titleLower.includes("monolith") ||
    titleLower.includes("data sharing") ||
    titleLower.includes("interview")
  ) {
    return "Microservices";
  } else if (
    titleLower.includes("architecture") ||
    titleLower.includes("scaling") ||
    titleLower.includes("design pattern") ||
    titleLower.includes("clean architecture") ||
    titleLower.includes("cqrs") ||
    titleLower.includes("event-driven") ||
    titleLower.includes("sidecar") ||
    titleLower.includes("stateless") ||
    titleLower.includes("cap") ||
    titleLower.includes("acid") ||
    titleLower.includes("base") ||
    titleLower.includes("solid") ||
    titleLower.includes("oop") ||
    titleLower.includes("coupling") ||
    titleLower.includes("cohesion") ||
    titleLower.includes("ddd") ||
    titleLower.includes("domain-driven")
  ) {
    return "Architecture";
  } else if (
    titleLower.includes("devops") ||
    titleLower.includes("cicd") ||
    titleLower.includes("infrastructure") ||
    titleLower.includes("kubernetes") ||
    titleLower.includes("container") ||
    titleLower.includes("docker") ||
    titleLower.includes("production") ||
    titleLower.includes("shipping")
  ) {
    return "DevOps";
  } else if (
    titleLower.includes("security") ||
    titleLower.includes("gateway") ||
    titleLower.includes("password") ||
    titleLower.includes("session") ||
    titleLower.includes("cookie") ||
    titleLower.includes("token") ||
    titleLower.includes("jwt") ||
    titleLower.includes("sso") ||
    titleLower.includes("oauth")
  ) {
    return "Security";
  } else if (
    titleLower.includes("networking") ||
    titleLower.includes("http") ||
    titleLower.includes("ipv4") ||
    titleLower.includes("latency") ||
    titleLower.includes("message queue") ||
    titleLower.includes("tcp") ||
    titleLower.includes("dns") ||
    titleLower.includes("protocol") ||
    titleLower.includes("kafka") ||
    titleLower.includes("rabbitmq")
  ) {
    return "Networking";
  } else if (
    titleLower.includes("testing") ||
    titleLower.includes("chaos") ||
    titleLower.includes("resilience") ||
    titleLower.includes("failure") ||
    titleLower.includes("reliability")
  ) {
    return "Testing";
  } else if (
    titleLower.includes("machine learning") ||
    titleLower.includes("recommendation") ||
    titleLower.includes("algorithm") ||
    titleLower.includes("ai") ||
    titleLower.includes("chatbot") ||
    titleLower.includes("langchain")
  ) {
    return "Machine Learning";
  } else if (
    titleLower.includes("career") ||
    titleLower.includes("resume") ||
    titleLower.includes("job") ||
    titleLower.includes("staff engineer") ||
    titleLower.includes("executives") ||
    titleLower.includes("promotion") ||
    titleLower.includes("under leveled") ||
    titleLower.includes("speedrunning")
  ) {
    return "Career";
  } else if (
    titleLower.includes("open source") ||
    titleLower.includes("project")
  ) {
    return "Open Source";
  } else if (
    titleLower.includes("code") ||
    titleLower.includes("tidying") ||
    titleLower.includes("best practice") ||
    titleLower.includes("non-functional") ||
    titleLower.includes("good code") ||
    titleLower.includes("bad code")
  ) {
    return "Best Practices";
  } else if (
    titleLower.includes("scaling") ||
    titleLower.includes("netflix") ||
    titleLower.includes("load balancer") ||
    titleLower.includes("capacity planning") ||
    titleLower.includes("hashing") ||
    titleLower.includes("leader election")
  ) {
    return "Scalability";
  } else if (
    titleLower.includes("serverless") ||
    titleLower.includes("cloud") ||
    titleLower.includes("virtualization") ||
    titleLower.includes("containerization")
  ) {
    return "Cloud Computing";
  } else if (
    titleLower.includes("interview") ||
    titleLower.includes("questions")
  ) {
    return "Interview Prep";
  } else {
    return "General";
  }
}

// Generate description based on title
function generateDescription(title) {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("crash course")) {
    return `A comprehensive crash course covering essential concepts and best practices in ${title
      .replace("A Crash Course in ", "")
      .replace("A Crash Course on ", "")}.`;
  } else if (titleLower.includes("scaling")) {
    return `Learn effective strategies and techniques for scaling systems and applications to handle growing demands.`;
  } else if (titleLower.includes("api")) {
    return `Essential guide to API design, implementation, and best practices for building robust and scalable APIs.`;
  } else if (titleLower.includes("database")) {
    return `Comprehensive coverage of database concepts, design principles, and optimization techniques.`;
  } else if (titleLower.includes("architecture")) {
    return `Explore architectural patterns and design principles for building scalable and maintainable systems.`;
  } else if (titleLower.includes("security")) {
    return `Important security considerations and best practices for protecting applications and data.`;
  } else if (titleLower.includes("networking")) {
    return `Understanding networking fundamentals and protocols for modern applications.`;
  } else if (titleLower.includes("devops")) {
    return `DevOps practices and tools for modern software development and deployment.`;
  } else if (titleLower.includes("microservice")) {
    return `Microservice architecture patterns and implementation strategies for distributed systems.`;
  } else if (titleLower.includes("testing")) {
    return `Testing strategies and techniques for ensuring software quality and reliability.`;
  } else if (titleLower.includes("career")) {
    return `Career development tips and strategies for software professionals.`;
  } else if (titleLower.includes("open source")) {
    return `Explore influential open-source projects and their impact on the technology landscape.`;
  } else {
    return `A comprehensive guide covering important concepts and best practices in software development.`;
  }
}

// Get appropriate icon for article
function getIconForArticle(title) {
  const titleLower = title.toLowerCase();

  if (
    titleLower.includes("api") ||
    titleLower.includes("rest") ||
    titleLower.includes("graphql")
  ) {
    return "fas fa-plug";
  } else if (titleLower.includes("database") || titleLower.includes("sql")) {
    return "fas fa-database";
  } else if (
    titleLower.includes("microservice") ||
    titleLower.includes("distributed")
  ) {
    return "fas fa-sitemap";
  } else if (
    titleLower.includes("architecture") ||
    titleLower.includes("scaling")
  ) {
    return "fas fa-building";
  } else if (titleLower.includes("devops") || titleLower.includes("cicd")) {
    return "fas fa-sync-alt";
  } else if (titleLower.includes("security")) {
    return "fas fa-shield-alt";
  } else if (titleLower.includes("networking") || titleLower.includes("http")) {
    return "fas fa-network-wired";
  } else if (titleLower.includes("testing") || titleLower.includes("chaos")) {
    return "fas fa-bug";
  } else if (
    titleLower.includes("machine learning") ||
    titleLower.includes("recommendation")
  ) {
    return "fas fa-brain";
  } else if (titleLower.includes("career") || titleLower.includes("resume")) {
    return "fas fa-file-alt";
  } else if (
    titleLower.includes("open source") ||
    titleLower.includes("project")
  ) {
    return "fas fa-globe";
  } else if (titleLower.includes("code") || titleLower.includes("tidying")) {
    return "fas fa-code";
  } else {
    return "fas fa-file-alt";
  }
}

// Render articles to the grid grouped by categories or as simple list
function renderArticles(articlesToRender) {
  articlesGrid.innerHTML = "";

  if (articlesToRender.length === 0) {
    showNoResults();
    return;
  }

  const sortType = sortFilter.value;

  // If "no sort" is selected, render with categories (original behavior)
  if (sortType === "no-sort") {
    // Group articles by category
    const groupedArticles = groupArticlesByCategory(articlesToRender);

    // Render each category group
    Object.keys(groupedArticles).forEach((category) => {
      const categorySection = createCategorySection(
        category,
        groupedArticles[category]
      );
      articlesGrid.appendChild(categorySection);
    });
  } else {
    // All other sort options render as simple list
    renderSimpleList(articlesToRender);
  }
}

// Render articles as simple list without categories
function renderSimpleList(articlesToRender) {
  const simpleGrid = document.createElement("div");
  simpleGrid.className = "simple-grid";

  articlesToRender.forEach((article, index) => {
    const articleCard = createArticleCard(article);
    articleCard.style.animationDelay = `${index * 0.1}s`;
    simpleGrid.appendChild(articleCard);
  });

  articlesGrid.appendChild(simpleGrid);
}

// Group articles by category
function groupArticlesByCategory(articles) {
  return articles.reduce((groups, article) => {
    const category = article.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(article);
    return groups;
  }, {});
}

// Create category section with header and cards
function createCategorySection(category, categoryArticles) {
  const section = document.createElement("div");
  section.className = "category-section";

  const categoryHeader = document.createElement("div");
  categoryHeader.className = "category-header";
  categoryHeader.innerHTML = `
    <h2 class="category-title">
      <i class="fas ${getCategoryIcon(category)}"></i>
      ${category}
      <span class="category-count">${categoryArticles.length}</span>
    </h2>
  `;

  const categoryGrid = document.createElement("div");
  categoryGrid.className = "category-grid";

  categoryArticles.forEach((article, index) => {
    const articleCard = createArticleCard(article);
    articleCard.style.animationDelay = `${index * 0.1}s`;
    categoryGrid.appendChild(articleCard);
  });

  section.appendChild(categoryHeader);
  section.appendChild(categoryGrid);

  return section;
}

// Get icon for category
function getCategoryIcon(category) {
  const iconMap = {
    APIs: "fa-plug",
    Database: "fa-database",
    Microservices: "fa-sitemap",
    Architecture: "fa-building",
    DevOps: "fa-sync-alt",
    Security: "fa-shield-alt",
    Networking: "fa-network-wired",
    Testing: "fa-bug",
    "Machine Learning": "fa-brain",
    Career: "fa-user-tie",
    "Open Source": "fa-globe",
    "Best Practices": "fa-code",
    Scalability: "fa-chart-line",
    "Cloud Computing": "fa-cloud",
    "Interview Prep": "fa-question-circle",
    General: "fa-file-alt",
  };
  return iconMap[category] || "fa-file-alt";
}

// Create individual article card
function createArticleCard(article) {
  const card = document.createElement("div");
  card.className = "article-card";

  card.innerHTML = `
        <div class="card-header">
            <div class="card-icon">
                <i class="${article.icon}"></i>
            </div>
            <div class="card-category">${article.category}</div>
        </div>
        
        <h3 class="card-title">${article.title}</h3>
        <p class="card-description">${article.description}</p>
        
        <div class="card-footer">
            <div class="card-meta">
                <span><i class="fas fa-calendar"></i> ${new Date(
                  article.dateAdded
                ).toLocaleDateString()}</span>
                ${
                  article.watched
                    ? '<span class="watched-badge"><i class="fas fa-check-circle"></i> Watched</span>'
                    : ""
                }
            </div>
            <div class="card-actions">
                <a href="${
                  article.filename
                }" class="btn btn-primary" target="_blank">
                    <i class="fas fa-external-link-alt"></i>
                    Read
                </a>
                <button class="btn btn-watched ${
                  article.watched ? "watched" : ""
                }" onclick="toggleWatched('${article.filename}')">
                    <i class="fas ${
                      article.watched ? "fa-eye-slash" : "fa-eye"
                    }"></i>
                    ${article.watched ? "Unwatch" : "Mark as Watched"}
                </button>
            </div>
        </div>
    `;

  return card;
}

// Setup search functionality
function setupSearch() {
  searchInput.addEventListener("input", function (e) {
    const searchTerm = e.target.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortType = sortFilter.value;

    let filteredArticles = articles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchTerm) ||
        article.category.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm);
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Apply sorting/filtering
    if (sortType === "watched") {
      filteredArticles = filteredArticles.filter((article) => article.watched);
    } else if (sortType === "unwatched") {
      filteredArticles = filteredArticles.filter((article) => !article.watched);
    } else if (sortType === "date") {
      filteredArticles.sort(
        (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
      );
    } else if (sortType === "title") {
      filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "no-sort" option keeps articles in their original order

    renderArticles(filteredArticles);
    updateStats(filteredArticles.length);
  });
}

// Setup category filter
function setupCategoryFilter() {
  categoryFilter.addEventListener("change", function (e) {
    const selectedCategory = e.target.value;
    const searchTerm = searchInput.value.toLowerCase();
    const sortType = sortFilter.value;

    let filteredArticles = articles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchTerm) ||
        article.category.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm);
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Apply sorting/filtering
    if (sortType === "watched") {
      filteredArticles = filteredArticles.filter((article) => article.watched);
    } else if (sortType === "unwatched") {
      filteredArticles = filteredArticles.filter((article) => !article.watched);
    } else if (sortType === "date") {
      filteredArticles.sort(
        (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
      );
    } else if (sortType === "title") {
      filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "no-sort" option keeps articles in their original order

    renderArticles(filteredArticles);
    updateStats(filteredArticles.length);
  });
}

// Populate category filter dropdown
function populateCategoryFilter() {
  const categories = [
    ...new Set(articles.map((article) => article.category)),
  ].sort();

  // Clear existing options except "All Categories"
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

// Update statistics
function updateStats(count = articles.length) {
  totalArticlesElement.textContent = count;
}

// Show loading state
function showLoading() {
  articlesGrid.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading articles...</p>
        </div>
    `;
}

// Show error message
function showError(message) {
  articlesGrid.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Show no results message
function showNoResults() {
  articlesGrid.innerHTML = `
        <div class="no-results">
            <i class="fas fa-search"></i>
            <h3>No articles found</h3>
            <p>Try adjusting your search terms</p>
        </div>
    `;
}

// Add keyboard navigation support
searchInput.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    this.value = "";
    renderArticles(articles);
    updateStats();
  }
});

// Add some interactive effects
document.addEventListener("DOMContentLoaded", function () {
  // Add hover effects to cards
  const cards = document.querySelectorAll(".article-card");
  cards.forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-10px) scale(1.02)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0) scale(1)";
    });
  });
});

// Add category filtering (bonus feature)
function filterByCategory(category) {
  const filteredArticles =
    category === "all"
      ? articles
      : articles.filter((article) => article.category === category);

  renderArticles(filteredArticles);
  updateStats(filteredArticles.length);
}

// Add some visual feedback for interactions
function addVisualFeedback(element, message) {
  const originalText = element.textContent;
  element.textContent = message;
  element.style.color = "#667eea";

  setTimeout(() => {
    element.textContent = originalText;
    element.style.color = "";
  }, 1000);
}

// Add smooth scrolling for better UX
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute("href")).scrollIntoView({
      behavior: "smooth",
    });
  });
});

// Local Storage Functions
function saveWatchedStatus() {
  const watchedArticles = articles
    .filter((article) => article.watched)
    .map((article) => article.filename);
  localStorage.setItem("watchedArticles", JSON.stringify(watchedArticles));
}

function loadWatchedStatus() {
  const watchedArticles = JSON.parse(
    localStorage.getItem("watchedArticles") || "[]"
  );
  articles.forEach((article) => {
    article.watched = watchedArticles.includes(article.filename);
  });
}

function loadWatchedArticles() {
  // This function is called on page load to initialize watched status
  // The actual loading is done in loadArticles()
}

// Setup sort filter
function setupSortFilter() {
  sortFilter.addEventListener("change", function (e) {
    const sortType = e.target.value;
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    let filteredArticles = articles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchTerm) ||
        article.category.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm);
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Apply sorting/filtering
    if (sortType === "watched") {
      filteredArticles = filteredArticles.filter((article) => article.watched);
    } else if (sortType === "unwatched") {
      filteredArticles = filteredArticles.filter((article) => !article.watched);
    } else if (sortType === "date") {
      filteredArticles.sort(
        (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
      );
    } else if (sortType === "title") {
      filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "no-sort" option keeps articles in their original order

    renderArticles(filteredArticles);
    updateStats(filteredArticles.length);
  });
}

// Toggle watched status
function toggleWatched(filename) {
  const article = articles.find((article) => article.filename === filename);
  if (article) {
    article.watched = !article.watched;
    saveWatchedStatus();

    // Re-render to update the UI
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortType = sortFilter.value;

    let filteredArticles = articles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchTerm) ||
        article.category.toLowerCase().includes(searchTerm) ||
        article.description.toLowerCase().includes(searchTerm);
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Apply current sorting/filtering
    if (sortType === "watched") {
      filteredArticles = filteredArticles.filter((article) => article.watched);
    } else if (sortType === "unwatched") {
      filteredArticles = filteredArticles.filter((article) => !article.watched);
    } else if (sortType === "date") {
      filteredArticles.sort(
        (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
      );
    } else if (sortType === "title") {
      filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
    }

    renderArticles(filteredArticles);
    updateStats(filteredArticles.length);
  }
}
