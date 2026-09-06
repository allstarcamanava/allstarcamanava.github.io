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

            {% if partner.logo and partner.logo != "" %}
              <div class="partner-logo">
                <img
                  src="{{ partner.logo | relative_url }}"
                  alt="{{ partner.name }}"
                  loading="lazy"
                >
              </div>
            {% endif %}

            <div class="partner-content">

              {% if partner.name and partner.name != "" %}
                <h2>{{ partner.name }}</h2>
              {% endif %}

              {% if partner.roles and partner.roles.size > 0 %}
                <div class="partner-roles">
                  {% for role in partner.roles %}
                    {% if role and role != "" %}
                      <span class="partner-role">{{ role }}</span>
                    {% endif %}
                  {% endfor %}
                </div>
              {% endif %}

              {% if partner.description and partner.description != "" %}
                <p>{{ partner.description }}</p>
              {% endif %}

              {% assign partner_website = partner.website | strip %}

              {% if partner_website != "" %}

                {% unless partner_website contains "://" %}
                  {% assign partner_website = "https://" | append: partner_website %}
                {% endunless %}

                <a
                  href="{{ partner_website }}"
                  class="partner-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit Website
                  <span aria-hidden="true">→</span>
                </a>

              {% endif %}

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