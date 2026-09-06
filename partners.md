---
layout: default
title: Partners
permalink: /partners/
---

<section class="page-hero">
  <div class="container">
    <p class="eyebrow">Our Partners</p>
    <h1>Partners</h1>
    <p class="page-intro">
      We are grateful to the organizations and individuals who support
      the Rotary E-Club of All Star CAMANAVA in creating meaningful
      service and community impact.
    </p>
  </div>
</section>

<section class="partners-section">
  <div class="container">

    {% if site.data.partners.partners and site.data.partners.partners.size > 0 %}

      <div class="partners-grid">

        {% for partner in site.data.partners.partners %}

          <article class="partner-card">

            {% unless partner.logo == blank %}
              <div class="partner-logo">
                <img
                  src="{{ partner.logo | relative_url }}"
                  alt="{{ partner.name }}"
                  loading="lazy"
                >
              </div>
            {% endunless %}

            <div class="partner-content">

              {% unless partner.name == blank %}
                <h2>{{ partner.name }}</h2>
              {% endunless %}

              {% unless partner.roles == blank %}
                <div class="partner-roles">
                  {% for role in partner.roles %}
                    {% unless role == blank %}
                      <span class="partner-role">{{ role }}</span>
                    {% endunless %}
                  {% endfor %}
                </div>
              {% endunless %}

              {% unless partner.description == blank %}
                <p>{{ partner.description }}</p>
              {% endunless %}

              {% unless partner.website == blank %}
                <a
                  href="{{ partner.website }}"
                  class="partner-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit Website
                  <span aria-hidden="true">→</span>
                </a>
              {% endunless %}

            </div>

          </article>

        {% endfor %}

      </div>

    {% else %}

      <div class="partners-empty">
        <h2>Our Partners</h2>
        <p>
          We look forward to building partnerships with organizations
          that share our commitment to service and community.
        </p>
      </div>

    {% endif %}

  </div>
</section>