#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { getDb, closeDb } from './db/connection';
import {
  discoverCompanies,
  getCompanyByName,
  getUnqualifiedCompanies,
  listCategories,
  getCategoryShortcuts,
} from './discovery/wikipedia';
import { crawlCompanyWebsite } from './qualification/crawler';
import {
  analyzePageContent,
  calculateQualificationScore,
  saveSignals,
  updateCompanyQualification,
  getQualifiedCompanies,
} from './qualification/analyzer';
import { extractContacts, saveContacts } from './contacts/extractor';
import {
  extractPeople,
  extractPeopleFromWikipedia,
  savePeople,
} from './people/extractor';
import { selectBestPaths, savePathSelection } from './ranking/pathSelector';
import { generateOutreach, saveOutreach } from './outreach/generator';
import {
  generateDigest,
  getDefaultDigestPath,
  prepareCompanyForDigest,
  getTopQualifiedCompanies,
} from './digest/markdown';

// Load environment variables
config();

const program = new Command();

program
  .name('sponsor-pathfinder')
  .description(
    'Discover, qualify, and route sponsorship leads for the Panna World Championship'
  )
  .version('1.0.0');

// Discover command
program
  .command('discover')
  .description('Discover potential sponsor companies from Wikipedia')
  .option(
    '-c, --category <category>',
    'Category shortcut OR any search term (e.g., "sportswear", "Danish fashion brands", "esports")'
  )
  .option('-r, --region <region>', 'Region filter (denmark, nordic, europe)')
  .option('-l, --limit <number>', 'Maximum number of companies to discover', '20')
  .action(async (options) => {
    try {
      if (!options.category) {
        const shortcuts = getCategoryShortcuts();
        console.log('\n━━━ Discovery Help ━━━\n');
        console.log('Usage: sponsor-pathfinder discover -c <category> [-l limit]\n');
        console.log('📁 Preset shortcuts (quick access):');
        for (const [key, categories] of Object.entries(shortcuts)) {
          console.log(`   ${key.padEnd(12)} → ${categories.slice(0, 2).join(', ')}${categories.length > 2 ? '...' : ''}`);
        }
        console.log('\n🔎 Or use ANY search term:');
        console.log('   discover -c "Danish fashion"');
        console.log('   discover -c "esports companies"');
        console.log('   discover -c "sustainable brands"');
        console.log('   discover -c "Luxury_fashion_brands"  (direct Wikipedia category)\n');
        return;
      }

      await discoverCompanies(
        options.category,
        options.region,
        parseInt(options.limit)
      );
    } catch (error) {
      console.error(
        '\n❌ Error:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    } finally {
      closeDb();
    }
  });

// Qualify command
program
  .command('qualify')
  .description('Qualify companies by analyzing their websites')
  .option('-c, --company <name>', 'Company name to qualify')
  .option('-a, --all', 'Qualify all unqualified companies')
  .option('-l, --limit <number>', 'Limit number of companies to qualify', '10')
  .action(async (options) => {
    try {
      let companies: Array<{
        id: number;
        name: string;
        wikipedia_url: string | null;
        website_url: string | null;
      }> = [];

      if (options.company) {
        const company = getCompanyByName(options.company);
        if (!company) {
          console.error(`\n❌ Company "${options.company}" not found in database.`);
          console.log('   Use "discover" command first to add companies.\n');
          process.exit(1);
        }
        companies = [company];
      } else if (options.all) {
        companies = getUnqualifiedCompanies().slice(
          0,
          parseInt(options.limit)
        );
      } else {
        console.log('\n━━━ Qualify Help ━━━\n');
        console.log('Usage:');
        console.log('  sponsor-pathfinder qualify -c "Company Name"');
        console.log('  sponsor-pathfinder qualify --all [-l 10]\n');
        return;
      }

      if (companies.length === 0) {
        console.log('\n⚠ No unqualified companies found.');
        console.log('  Use "discover" command first to add companies.\n');
        return;
      }

      console.log(`\n━━━ Qualification Starting ━━━`);
      console.log(`📋 Companies to process: ${companies.length}\n`);

      let qualifiedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        console.log(`\n━━━ [${i + 1}/${companies.length}] ${company.name} ━━━`);

        if (!company.website_url) {
          console.log('   ⚠ No website URL found, skipping...');
          skippedCount++;
          continue;
        }

        console.log(`   🌐 Website: ${company.website_url}`);

        // Crawl website
        console.log(`\n   📥 Step 1: Crawling website...`);
        const crawlResults = await crawlCompanyWebsite(company.website_url);
        const pagesFound = Array.from(crawlResults.values()).filter(r => r.success).length;
        console.log(`      ✓ Crawled ${pagesFound} pages`);

        // Analyze signals
        console.log(`\n   🔍 Step 2: Analyzing sponsorship signals...`);
        const signals = analyzePageContent(crawlResults);
        const score = calculateQualificationScore(signals);

        if (signals.length > 0) {
          console.log(`      Found ${signals.length} signals:`);
          for (const signal of signals) {
            console.log(`        • ${signal.type} (+${signal.score} pts)`);
          }
        } else {
          console.log(`      No sponsorship signals found`);
        }
        console.log(`      📊 Score: ${score}/100`);

        // Save results
        saveSignals(company.id, signals);
        updateCompanyQualification(company.id, score);

        // Extract contacts
        console.log(`\n   📧 Step 3: Extracting contact paths...`);
        const contacts = extractContacts(crawlResults, company.website_url);
        saveContacts(company.id, contacts);

        if (contacts.length > 0) {
          console.log(`      Found ${contacts.length} contact paths:`);
          for (const contact of contacts.slice(0, 3)) {
            console.log(`        • ${contact.pathType}: ${contact.value}`);
          }
          if (contacts.length > 3) {
            console.log(`        ... and ${contacts.length - 3} more`);
          }
        } else {
          console.log(`      No contact paths found`);
        }

        // Extract people
        console.log(`\n   👤 Step 4: Finding decision makers...`);
        let people = extractPeople(crawlResults, company.name);

        // Also try Wikipedia
        if (company.wikipedia_url) {
          console.log(`      Checking Wikipedia for executives...`);
          const wikiPeople = await extractPeopleFromWikipedia(
            company.wikipedia_url,
            company.name
          );
          people = [...people, ...wikiPeople];
        }

        savePeople(company.id, people);

        if (people.length > 0) {
          console.log(`      Found ${people.length} people:`);
          for (const person of people.slice(0, 3)) {
            console.log(`        • ${person.name}${person.jobTitle ? ` - ${person.jobTitle}` : ''}`);
          }
          if (people.length > 3) {
            console.log(`        ... and ${people.length - 3} more`);
          }
        } else {
          console.log(`      No decision makers found`);
        }

        // Select best path
        console.log(`\n   🎯 Step 5: Selecting best contact path...`);
        const pathSelection = selectBestPaths(company.id, company.name);
        if (pathSelection) {
          savePathSelection(company.id, pathSelection);
          console.log(`      Primary: ${pathSelection.primary.type} → ${pathSelection.primary.value}`);
          if (pathSelection.backup) {
            console.log(`      Backup:  ${pathSelection.backup.type} → ${pathSelection.backup.value}`);
          }
        }

        // Final status
        const isQualified = score >= 50;
        if (isQualified) {
          qualifiedCount++;
          console.log(`\n   ✅ QUALIFIED (score: ${score})`);
        } else {
          console.log(`\n   ❌ NOT QUALIFIED (score: ${score}, need 50+)`);
        }
      }

      console.log(`\n━━━ Qualification Complete ━━━`);
      console.log(`   ✓ Qualified: ${qualifiedCount}`);
      console.log(`   ✗ Not qualified: ${companies.length - qualifiedCount - skippedCount}`);
      console.log(`   ⚠ Skipped: ${skippedCount}\n`);
    } catch (error) {
      console.error(
        '\n❌ Error:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    } finally {
      closeDb();
    }
  });

// Daily sponsors command
program
  .command('daily_sponsors')
  .description('Generate daily sponsor digest with outreach copy')
  .option('-n, --count <number>', 'Number of sponsors in digest', '3')
  .option('-r, --region <region>', 'Region filter for LinkedIn URLs')
  .option('-o, --output <path>', 'Output file path')
  .option('--no-ai', 'Skip AI-generated outreach (faster, no API cost)')
  .action(async (options) => {
    try {
      const count = parseInt(options.count);

      console.log(`\nGenerating daily sponsor digest (${count} companies)...\n`);

      // Get top qualified companies
      const topCompanies = getTopQualifiedCompanies(count);

      if (topCompanies.length === 0) {
        console.log('No qualified companies found.');
        console.log('Use "discover" and "qualify" commands first.');
        return;
      }

      const digestCompanies = [];

      for (const company of topCompanies) {
        console.log(`Processing: ${company.name}`);

        const companyData = prepareCompanyForDigest(company.id, options.region);

        let outreach = null;

        if (options.ai !== false && companyData.pathSelection) {
          try {
            console.log('  Generating outreach with AI...');
            outreach = await generateOutreach(
              company.name,
              companyData.signals,
              companyData.pathSelection.primary
            );

            // Save to database
            saveOutreach(company.id, null, null, outreach);
          } catch (error) {
            console.log(
              '  ⚠ AI generation failed:',
              error instanceof Error ? error.message : error
            );
          }
        }

        digestCompanies.push({
          ...companyData,
          outreach,
        });
      }

      // Generate markdown
      const outputPath = options.output || getDefaultDigestPath();
      const markdown = generateDigest(digestCompanies, outputPath);

      console.log(`\n✓ Digest saved to: ${outputPath}`);
      console.log(`\nPreview:\n`);
      console.log(markdown.slice(0, 500) + '...\n');
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    } finally {
      closeDb();
    }
  });

// Status command
program
  .command('status')
  .description('Show database status')
  .action(() => {
    try {
      const db = getDb();

      const totalCompanies = db
        .prepare('SELECT COUNT(*) as count FROM companies')
        .get() as { count: number };
      const qualified = db
        .prepare(
          "SELECT COUNT(*) as count FROM companies WHERE status = 'qualified'"
        )
        .get() as { count: number };
      const unqualified = db
        .prepare(
          "SELECT COUNT(*) as count FROM companies WHERE status = 'unqualified'"
        )
        .get() as { count: number };
      const contacts = db
        .prepare('SELECT COUNT(*) as count FROM contact_paths')
        .get() as { count: number };
      const people = db
        .prepare('SELECT COUNT(*) as count FROM people')
        .get() as { count: number };

      console.log('\n━━━ Database Status ━━━\n');
      console.log(`Total companies:     ${totalCompanies.count}`);
      console.log(`  Qualified:         ${qualified.count}`);
      console.log(`  Unqualified:       ${unqualified.count}`);
      console.log(`Contact paths:       ${contacts.count}`);
      console.log(`People:              ${people.count}`);

      if (qualified.count > 0) {
        console.log('\n━━━ Top Qualified Companies ━━━\n');
        const top = getQualifiedCompanies().slice(0, 5);
        for (const company of top) {
          console.log(
            `  ${company.name} (score: ${company.qualification_score})`
          );
        }
      }

      console.log('');
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    } finally {
      closeDb();
    }
  });

// List command
program
  .command('list')
  .description('List companies in the database')
  .option('-s, --status <status>', 'Filter by status (qualified, unqualified)')
  .option('-l, --limit <number>', 'Limit results', '20')
  .action((options) => {
    try {
      const db = getDb();

      let query = 'SELECT name, status, qualification_score, website_url FROM companies';
      const params: string[] = [];

      if (options.status) {
        query += ' WHERE status = ?';
        params.push(options.status);
      }

      query += ' ORDER BY qualification_score DESC LIMIT ?';
      params.push(options.limit);

      const companies = db.prepare(query).all(...params) as Array<{
        name: string;
        status: string;
        qualification_score: number;
        website_url: string | null;
      }>;

      console.log('\n━━━ Companies ━━━\n');

      if (companies.length === 0) {
        console.log('No companies found.');
      } else {
        for (const company of companies) {
          const statusIcon =
            company.status === 'qualified' ? '✓' : '○';
          console.log(
            `${statusIcon} ${company.name} (${company.qualification_score}) - ${company.website_url || 'no website'}`
          );
        }
      }

      console.log('');
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    } finally {
      closeDb();
    }
  });

program.parse();
