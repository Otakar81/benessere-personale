(function () {
  const WHOLE_MEAL_MIN_SCORE = 0.65;
  const COMPONENT_MIN_SCORE = 0.6;
  const FUZZY_GOOD_SCORE = 0.85;
  const SOURCE_PRIORITY = {
    historical: 2,
    derived: 1
  };

  function normalizeMeal(text) {
    if (!text) return "";

    return String(text)
      .toLowerCase()
      .replaceAll("+", " e ")
      .replaceAll("&", " e ")
      .replaceAll(" ed ", " e ")
      .replace(/\bfettine\b/g, "fette")
      .replace(/\blombo\b/g, "lonza")
      .replace(/\bcarote\b/g, "carota")
      .replace(/\bfragole\b/g, "fragola")
      .replace(/\bpomodori\b/g, "pomodoro")
      .replace(/\barance\b/g, "arancia")
      .replace(/[.,;:!?()[\]{}"'“”’]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractInlineKcal(text) {
    const matches = [...String(text || "").matchAll(/\(?\b(\d{2,4})\s*kcal\b\)?/gi)];
    return matches.map(match => Number(match[1])).filter(Number.isFinite);
  }

  function stripInlineKcal(text) {
    return String(text || "")
      .replace(/\(?\b\d{2,4}\s*kcal\b\)?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeMeal(text) {
    return normalizeMeal(text)
      .split(" ")
      .map(token => token.trim())
      .filter(Boolean)
      .filter(token => !["e", "di", "con", "un", "una", "il", "la", "lo"].includes(token));
  }

  function tokenSimilarity(a, b) {
    const tokensA = new Set(tokenizeMeal(a));
    const tokensB = new Set(tokenizeMeal(b));

    const intersection = [...tokensA].filter(token => tokensB.has(token)).length;
    const union = new Set([...tokensA, ...tokensB]).size;

    return union === 0 ? 0 : intersection / union;
  }

  function normalizeFoodSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,;:!?()[\]{}"']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findFoodCostMatches(query, dictionary, limit = 5) {
    const normalizedQuery = normalizeFoodSearchText(query);
    const queryWords = normalizedQuery.split(" ").filter(Boolean);

    if (normalizedQuery.length < 2 || !dictionary || typeof dictionary !== "object") {
      return [];
    }

    return Object.entries(dictionary)
      .map(([name, entry]) => {
        const kcal = Number(entry?.kcal);
        const normalizedName = normalizeFoodSearchText(name);
        const nameWords = normalizedName.split(" ").filter(Boolean);
        const matchedWords = queryWords.filter(word =>
          nameWords.some(nameWord => nameWord === word || nameWord.startsWith(word))
        ).length;

        let rank = 99;
        if (normalizedName === normalizedQuery) {
          rank = 0;
        } else if (normalizedName.startsWith(normalizedQuery)) {
          rank = 1;
        } else if (normalizedName.includes(normalizedQuery)) {
          rank = 2;
        } else if (matchedWords > 0) {
          rank = 3;
        }

        return {
          name,
          kcal,
          rank,
          matchedWords,
          samples: Number(entry?.samples) || 0
        };
      })
      .filter(item => item.rank < 99 && Number.isFinite(item.kcal) && item.kcal > 0)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (b.matchedWords !== a.matchedWords) return b.matchedWords - a.matchedWords;
        if (b.samples !== a.samples) return b.samples - a.samples;
        return a.name.length - b.name.length;
      })
      .slice(0, limit);
  }

  function getSourcePriority(source) {
    return SOURCE_PRIORITY[source] || 0;
  }

  function buildMatch(key, entry, score, isExactString = false) {
    const source = entry.source || "historical";

    return {
      key,
      kcal: Number(entry.kcal) || 0,
      samples: entry.samples,
      confidence: entry.confidence,
      source,
      score,
      matchType: isExactString ? "exact" : (score >= FUZZY_GOOD_SCORE ? "fuzzy-good" : "fuzzy-weak")
    };
  }

  function compareMatches(a, b) {
    const scoreDelta = b.score - a.score;
    if (Math.abs(scoreDelta) > 0.05) {
      return scoreDelta;
    }

    const sourceDelta = getSourcePriority(b.source) - getSourcePriority(a.source);
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    return (b.samples || 0) - (a.samples || 0);
  }

  function findTopMealCandidates(inputMeal, dictionary, limit = 5) {
    const normalized = normalizeMeal(inputMeal);
    const normalizedWithoutInline = normalizeMeal(stripInlineKcal(inputMeal));

    if (!normalized || !dictionary || typeof dictionary !== "object") {
      return [];
    }

    return Object.entries(dictionary)
      .map(([key, entry]) => {
        const exactNormalized = key === normalized;
        const exactWithoutInline = normalizedWithoutInline && key === normalizedWithoutInline;
        const score = exactNormalized || exactWithoutInline
          ? 1
          : Math.max(
              tokenSimilarity(normalized, key),
              normalizedWithoutInline ? tokenSimilarity(normalizedWithoutInline, key) : 0
            );

        return buildMatch(key, entry, score, exactNormalized || exactWithoutInline);
      })
      .sort(compareMatches)
      .slice(0, limit);
  }

  function findBestMealMatch(inputMeal, dictionary, options = {}) {
    const normalized = normalizeMeal(inputMeal);
    const minScore = options.minScore ?? WHOLE_MEAL_MIN_SCORE;

    if (!normalized || !dictionary || typeof dictionary !== "object") {
      return null;
    }

    const [best] = findTopMealCandidates(inputMeal, dictionary, 1);
    if (!best || best.score < minScore) {
      return null;
    }

    return best;
  }

  function splitSegmentByComma(segment) {
    const rawParts = segment
      .split(",")
      .map(part => normalizeMeal(part))
      .filter(Boolean);

    const merged = [];

    for (const part of rawParts) {
      if (!part) continue;

      if (merged.length > 0 && /^con\b/.test(part)) {
        merged[merged.length - 1] = normalizeMeal(`${merged[merged.length - 1]} ${part}`);
        continue;
      }

      merged.push(part);
    }

    return merged;
  }

  function splitEnumerativeComponent(component) {
    if (!component.includes(" e ")) {
      return [component];
    }

    if (/\btoast con\b/.test(component) || /\bpane integrale\b/.test(component)) {
      return [component];
    }

    const cleaned = component.replace(/^con\s+/, "");
    const parts = cleaned
      .split(/\s+e\s+/)
      .map(part => normalizeMeal(part))
      .filter(Boolean);

    return parts.length > 1 ? parts : [component];
  }

  function splitMealIntoComponents(text) {
    const raw = String(text || "")
      .toLowerCase()
      .replaceAll("+", " e ")
      .replaceAll("&", " e ")
      .replaceAll(" ed ", " e ");
    if (!raw.trim()) return [];

    const strongSegments = raw
      .split(/[.;]+/)
      .map(segment => segment.trim())
      .filter(Boolean);

    const components = [];

    for (const segment of strongSegments) {
      const commaParts = splitSegmentByComma(segment);

      for (const part of commaParts) {
        const subParts = splitEnumerativeComponent(part);
        for (const subPart of subParts) {
          if (subPart) {
            components.push(subPart);
          }
        }
      }
    }

    return [...new Set(components)];
  }

  function estimateInlineKcalComponent(componentText) {
    const kcalValues = extractInlineKcal(componentText);
    if (kcalValues.length !== 1) {
      return null;
    }

    const cleanedInput = normalizeMeal(stripInlineKcal(componentText));

    return {
      input: componentText,
      matchedKey: cleanedInput || normalizeMeal(componentText),
      kcal: kcalValues[0],
      score: 1,
      confidence: "alta",
      source: "inline-kcal",
      matchType: "inline-kcal",
      samples: 1
    };
  }

  function estimateMealComponent(componentText, dictionary) {
    const inlineEstimate = estimateInlineKcalComponent(componentText);
    if (inlineEstimate) {
      return inlineEstimate;
    }

    const exactOrStrong = findBestMealMatch(componentText, dictionary, {
      minScore: COMPONENT_MIN_SCORE
    });

    if (!exactOrStrong) {
      return null;
    }

    return {
      input: componentText,
      matchedKey: exactOrStrong.key,
      kcal: Number(exactOrStrong.kcal) || 0,
      score: exactOrStrong.score,
      confidence: exactOrStrong.confidence,
      source: exactOrStrong.source,
      matchType: exactOrStrong.matchType,
      samples: exactOrStrong.samples
    };
  }

  function estimateCompositeMeal(text, dictionary) {
    const components = splitMealIntoComponents(text);
    if (components.length === 0) {
      return null;
    }

    const matchedComponents = [];
    const unmatchedComponents = [];

    for (const component of components) {
      const match = estimateMealComponent(component, dictionary);

      if (match) {
        matchedComponents.push(match);
      } else {
        unmatchedComponents.push({
          input: component
        });
      }
    }

    if (matchedComponents.length === 0) {
      return null;
    }

    const total = matchedComponents.reduce((sum, item) => sum + item.kcal, 0);
    const coverageRatio = matchedComponents.length / components.length;
    const weakestScore = Math.min(...matchedComponents.map(item => item.score));
    const hasDerived = matchedComponents.some(item => item.source === "derived");
    const hasInline = matchedComponents.some(item => item.source === "inline-kcal");

    return {
      key: normalizeMeal(text),
      kcal: Math.round(total),
      samples: matchedComponents.reduce((sum, item) => sum + (item.samples || 0), 0),
      confidence: coverageRatio === 1 && !hasDerived ? "media" : "bassa",
      source: hasInline ? "inline-kcal" : (hasDerived ? "derived" : "historical"),
      score: coverageRatio * weakestScore,
      matchType: coverageRatio === 1 ? "composite-full" : "composite-partial",
      estimationMode: "components",
      matchedComponents,
      unmatchedComponents,
      coverageRatio,
      totalComponents: components.length,
      matchedComponentCount: matchedComponents.length
    };
  }

  function computeEstimateReliability(matched, unmatched) {
    if (matched.length === 0) {
      return "non disponibile";
    }

    const weakMatches = matched.filter(item =>
      item.matchType === "fuzzy-weak" ||
      item.confidence === "bassa" ||
      item.source === "derived" ||
      item.estimationMode === "components" ||
      item.matchType === "composite-partial"
    ).length;

    const partialMeals = matched.filter(item =>
      item.estimationMode === "components" || item.matchType === "composite-partial"
    ).length;

    const unmatchedComponents = matched.reduce((total, item) => {
      return total + ((item.unmatchedComponents && item.unmatchedComponents.length) || 0);
    }, 0);

    if (unmatched.length >= 2 || partialMeals >= 2 || unmatchedComponents >= 2) {
      return "bassa";
    }

    if (weakMatches >= 2) {
      return "bassa";
    }

    if (weakMatches === 1 || unmatched.length === 1 || unmatchedComponents === 1) {
      return "media";
    }

    return "alta";
  }

  function estimateMeal(text, dictionary) {
    const wholeInlineEstimate = estimateInlineKcalComponent(text);
    if (wholeInlineEstimate && splitMealIntoComponents(text).length <= 1) {
      return {
        key: wholeInlineEstimate.matchedKey,
        kcal: wholeInlineEstimate.kcal,
        samples: wholeInlineEstimate.samples,
        confidence: wholeInlineEstimate.confidence,
        source: wholeInlineEstimate.source,
        score: wholeInlineEstimate.score,
        matchType: wholeInlineEstimate.matchType,
        estimationMode: "whole",
        matchedComponents: [],
        unmatchedComponents: [],
        coverageRatio: 1,
        totalComponents: 1,
        matchedComponentCount: 1
      };
    }

    const wholeMatch = findBestMealMatch(text, dictionary, {
      minScore: WHOLE_MEAL_MIN_SCORE
    });

    const compositeMatch = estimateCompositeMeal(text, dictionary);

    if (wholeMatch && (wholeMatch.matchType === "exact" || wholeMatch.matchType === "fuzzy-good")) {
      return {
        key: wholeMatch.key,
        kcal: Number(wholeMatch.kcal) || 0,
        samples: wholeMatch.samples,
        confidence: wholeMatch.confidence,
        source: wholeMatch.source,
        score: wholeMatch.score,
        matchType: wholeMatch.matchType,
        estimationMode: "whole",
        matchedComponents: [],
        unmatchedComponents: [],
        coverageRatio: 1,
        totalComponents: 1,
        matchedComponentCount: 1
      };
    }

    if (wholeMatch && compositeMatch) {
      if (
        compositeMatch.coverageRatio >= 1 ||
        compositeMatch.matchedComponentCount >= 2 ||
        compositeMatch.kcal > wholeMatch.kcal
      ) {
        return compositeMatch;
      }

      return {
        key: wholeMatch.key,
        kcal: Number(wholeMatch.kcal) || 0,
        samples: wholeMatch.samples,
        confidence: wholeMatch.confidence,
        source: wholeMatch.source,
        score: wholeMatch.score,
        matchType: wholeMatch.matchType,
        estimationMode: "whole",
        matchedComponents: [],
        unmatchedComponents: [],
        coverageRatio: 1,
        totalComponents: 1,
        matchedComponentCount: 1
      };
    }

    if (wholeMatch) {
      return {
        key: wholeMatch.key,
        kcal: Number(wholeMatch.kcal) || 0,
        samples: wholeMatch.samples,
        confidence: wholeMatch.confidence,
        source: wholeMatch.source,
        score: wholeMatch.score,
        matchType: wholeMatch.matchType,
        estimationMode: "whole",
        matchedComponents: [],
        unmatchedComponents: [],
        coverageRatio: 1,
        totalComponents: 1,
        matchedComponentCount: 1
      };
    }

    return compositeMatch;
  }

  function estimateTodayCalories(todayRow, dictionary) {
    const meals = [
      ["Colazione", todayRow.colazione],
      ["Snack mattutino", todayRow.snackMattutino],
      ["Pranzo", todayRow.pranzo],
      ["Snack pomeridiano", todayRow.snackPomeridiano],
      ["Cena", todayRow.cena],
      ["Snack serale", todayRow.snackSerale]
    ];

    const matched = [];
    const unmatched = [];
    let total = 0;

    for (const [label, text] of meals) {
      if (!text || !String(text).trim()) continue;

      const match = estimateMeal(text, dictionary);

      if (match) {
        total += Number(match.kcal) || 0;

        matched.push({
          label,
          input: text,
          matchedKey: match.key,
          kcal: Number(match.kcal) || 0,
          score: match.score,
          confidence: match.confidence,
          source: match.source,
          matchType: match.matchType,
          samples: match.samples,
          estimationMode: match.estimationMode,
          matchedComponents: match.matchedComponents || [],
          unmatchedComponents: match.unmatchedComponents || [],
          coverageRatio: match.coverageRatio ?? 1,
          totalComponents: match.totalComponents ?? 1,
          matchedComponentCount: match.matchedComponentCount ?? 1
        });
      } else {
        unmatched.push({
          label,
          input: text
        });
      }
    }

    return {
      total: Math.round(total),
      matched,
      unmatched,
      reliability: computeEstimateReliability(matched, unmatched)
    };
  }

  function isSameDay(dateA, dateB) {
    return dateA.getFullYear() === dateB.getFullYear()
      && dateA.getMonth() === dateB.getMonth()
      && dateA.getDate() === dateB.getDate();
  }

  function computeCalorieResidual(total, target, tolerance = 50) {
    if (!Number.isFinite(total) || !Number.isFinite(target)) {
      return {
        status: "unknown",
        amount: null,
        signedDelta: null
      };
    }

    const signedDelta = Math.round(target - total);

    if (Math.abs(signedDelta) <= tolerance) {
      return {
        status: "balanced",
        amount: 0,
        signedDelta
      };
    }

    if (signedDelta > 0) {
      return {
        status: "remaining",
        amount: signedDelta,
        signedDelta
      };
    }

    return {
      status: "exceeded",
      amount: Math.abs(signedDelta),
      signedDelta
    };
  }

  window.liveCaloriesUtils = {
    normalizeMeal,
    extractInlineKcal,
    stripInlineKcal,
    tokenSimilarity,
    normalizeFoodSearchText,
    findFoodCostMatches,
    findTopMealCandidates,
    findBestMealMatch,
    splitMealIntoComponents,
    estimateInlineKcalComponent,
    estimateMealComponent,
    estimateCompositeMeal,
    estimateMeal,
    estimateTodayCalories,
    computeEstimateReliability,
    isSameDay,
    computeCalorieResidual
  };
})();
